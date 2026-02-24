import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { env } from './config/env';
import { initializeDatabase, closeDatabase } from './database/db';
import { logger } from './middleware/logger';
import { createRateLimitMiddleware, createOriginValidation } from './middleware/auth';

// Controllers
import * as authController from './controllers/authController';
import * as sampleController from './controllers/sampleController';
import * as groupController from './controllers/groupController';
import * as imageController from '@controllers/imageController';
import { downloadSample } from '@controllers/downloadController';
import * as resultController from './controllers/resultController';

// Rate limiters (instâncias separadas para diferentes endpoints)
const authRateLimit = createRateLimitMiddleware(15 * 60 * 1000, 20); // 20 req / 15 min para auth
const apiRateLimit = createRateLimitMiddleware(15 * 60 * 1000, 100); // 100 req / 15 min para API geral

// Origin validation middleware (K - CSRF protection)
const originValidation = createOriginValidation();

async function startServer() {
  try {
    // Inicializa banco de dados
    initializeDatabase();
    logger.info('Banco de dados inicializado');

    // Cria aplicação Elysia
    const app = new Elysia()
      .use(cors({
        origin: env.NODE_ENV === 'production'
          ? env.FRONTEND_URL
          : true, // Em desenvolvimento aceita qualquer origem
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      }))
      // Security headers
      .onBeforeHandle(({ set, request }) => {
        set.headers['X-Content-Type-Options'] = 'nosniff';
        set.headers['X-Frame-Options'] = 'DENY';
        set.headers['X-XSS-Protection'] = '1; mode=block';
        set.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
        if (env.NODE_ENV === 'production') {
          set.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
        }

        // K - Origin validation (CSRF) para requisições mutantes em produção
        const blocked = originValidation.beforeHandle({ request, set });
        if (blocked) return blocked;
      })
      .onError(({ code, error, set }) => {
        // Não loga NOT_FOUND como erro, é esperado
        if (code !== 'NOT_FOUND') {
          logger.error('Erro na requisição', error as Error);
        }
        
        if (code === 'NOT_FOUND') {
          set.status = 404;
          return {
            success: false,
            error: 'Rota não encontrada',
            code: 'NOT_FOUND',
            timestamp: new Date().toISOString()
          };
        }
        
        set.status = 500;
        
        // Retorna sempre JSON válido
        return {
          success: false,
          error: error.message || 'Erro interno do servidor',
          code: code || 'INTERNAL_ERROR',
          timestamp: new Date().toISOString()
        };
      })
      .get('/', () => ({
        message: 'Fingerprint Proficiency Test API',
        version: '1.0.0',
        status: 'running'
      }))
      .get('/health', () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV || 'development',
      }))
      // Rotas de autenticação (com rate limiting)
      .post('/api/auth/register', async ({ body, request, set }: any) => {
        const blocked = authRateLimit.beforeHandle({ request, set });
        if (blocked) return blocked;
        try {
          return await authController.registerParticipant(body);
        } catch (error: any) {
          logger.error('Erro no registro', error);
          return {
            success: false,
            error: error.message || 'Erro ao registrar participante',
            code: error.code || 'REGISTER_ERROR'
          };
        }
      })
      .post('/api/auth/login', async ({ body, request, set }: any) => {
        const blocked = authRateLimit.beforeHandle({ request, set });
        if (blocked) return blocked;
        try {
          return await authController.loginParticipant(body);
        } catch (error: any) {
          logger.error('Erro no login', error);
          return {
            success: false,
            error: error.message || 'Erro ao fazer login',
            code: error.code || 'LOGIN_ERROR'
          };
        }
      })
      .post('/api/auth/validate-email', async ({ body, request, set }: any) => {
        const blocked = authRateLimit.beforeHandle({ request, set });
        if (blocked) return blocked;
        return await authController.validateEmail(body);
      })
      .post('/api/auth/validate-code', async ({ body, request, set }: any) => {
        const blocked = authRateLimit.beforeHandle({ request, set });
        if (blocked) return blocked;
        return await authController.validateCode(body);
      })
      .post('/api/auth/forgot-code', async ({ body, request, set }: any) => {
        const blocked = authRateLimit.beforeHandle({ request, set });
        if (blocked) return blocked;
        return await authController.forgotCode(body);
      })
      .get('/api/auth/verify-email/:token', async ({ params }: any) => {
        try {
          return await authController.verifyEmail(params.token);
        } catch (error: any) {
          logger.error('Erro ao validar email', error);
          return {
            success: false,
            error: error.message || 'Erro ao validar email',
            code: error.code || 'VERIFICATION_ERROR'
          };
        }
      })
      // J - Refresh token
      .post('/api/auth/refresh', async ({ body, request, set }: any) => {
        const blocked = authRateLimit.beforeHandle({ request, set });
        if (blocked) return blocked;
        try {
          return await authController.refreshAccessToken(body);
        } catch (error: any) {
          logger.error('Erro ao renovar token', error);
          set.status = 401;
          return {
            success: false,
            error: error.message || 'Erro ao renovar token',
            code: 'REFRESH_ERROR'
          };
        }
      })
      // J - Logout (invalida refresh token)
      .post('/api/auth/logout', async ({ body }: any) => {
        try {
          return await authController.logoutParticipant(body);
        } catch (error: any) {
          return { success: true }; // Logout nunca falha para o cliente
        }
      })
      // Rotas de amostras (protegidas)
      .get('/api/samples', async ({ headers }: any) => {
        const authHeader = headers['authorization'];
        if (!authHeader) {
          return { success: false, error: 'Não autorizado' };
        }
        const token = authHeader.replace('Bearer ', '');
        return await sampleController.getParticipantSamples({ token });
      })
      .get('/api/samples/:id', async ({ params, headers }: any) => {
        const authHeader = headers['authorization'];
        if (!authHeader) {
          return { success: false, error: 'Não autorizado' };
        }
        const token = authHeader.replace('Bearer ', '');
        return await sampleController.getSampleDetails({ token, sample_id: params.id });
      })
      .get('/api/samples/:id/progress', async ({ params, headers }: any) => {
        const authHeader = headers['authorization'];
        if (!authHeader) {
          return { success: false, error: 'Não autorizado' };
        }
        const token = authHeader.replace('Bearer ', '');
        return await sampleController.getSampleProgress({ token, sample_id: params.id });
      })
      .post('/api/samples/request', async ({ headers }: any) => {
        try {
          const authHeader = headers['authorization'];
          if (!authHeader) {
            return { success: false, error: 'Não autorizado' };
          }
          const token = authHeader.replace('Bearer ', '');
          return await sampleController.requestNewSample({ token });
        } catch (error: any) {
          logger.error('Erro ao solicitar nova amostra', error);
          return {
            success: false,
            error: error.message || 'Erro ao solicitar nova amostra',
            code: error.code || 'REQUEST_SAMPLE_ERROR'
          };
        }
      })
      // Rejeitar amostra
      .delete('/api/samples/:id', async ({ params, headers }: any) => {
        try {
          const authHeader = headers['authorization'];
          if (!authHeader) {
            return { success: false, error: 'Não autorizado' };
          }
          const token = authHeader.replace('Bearer ', '');
          return await sampleController.rejectSample({ token, sample_id: params.id });
        } catch (error: any) {
          logger.error('Erro ao rejeitar amostra', error);
          return {
            success: false,
            error: error.message || 'Erro ao rejeitar amostra',
            code: error.code || 'REJECT_SAMPLE_ERROR'
          };
        }
      })
      // Excluir conta
      .delete('/api/account', async ({ headers }: any) => {
        try {
          const authHeader = headers['authorization'];
          if (!authHeader) {
            return { success: false, error: 'Não autorizado' };
          }
          const token = authHeader.replace('Bearer ', '');
          return await authController.deleteAccount({ token });
        } catch (error: any) {
          logger.error('Erro ao excluir conta', error);
          return {
            success: false,
            error: error.message || 'Erro ao excluir conta',
            code: error.code || 'DELETE_ACCOUNT_ERROR'
          };
        }
      })
      // Rotas de grupos
      .post('/api/samples/:id/groups', async ({ params }: any) => {
        return await groupController.createGroupsForSample(params.id);
      })
      .get('/api/samples/:id/groups', async ({ params }: any) => {
        return await groupController.getGroupsBySample(params.id);
      })
      .get('/api/groups/:id', async ({ params }: any) => {
        return await groupController.getGroupById(params.id);
      })
      // Rotas de imagens
      .get('/api/images/:filename', async ({ params }: any) => {
        const result = await imageController.serveImage(params.filename);
        if (result.success && result.path) {
          return Bun.file(result.path);
        }
        return result;
      })
      .get('/api/sample-images/:carryCode/:groupId/:filename', async ({ params }: any) => {
        const result = await imageController.serveSampleImage(
          params.carryCode,
          params.groupId,
          params.filename
        );
        if (result.success && result.path) {
          return Bun.file(result.path);
        }
        return result;
      })
      // Download de amostra (protegido)
      .get('/api/samples/:id/download', async ({ params, headers, query, set }: any) => {
        try {
          // Aceita token via header ou query param (para window.open)
          const authHeader = headers['authorization'];
          const tokenFromQuery = query?.token;
          const token = authHeader ? authHeader.replace('Bearer ', '') : tokenFromQuery;

          if (!token) {
            set.status = 401;
            return { success: false, error: 'Não autorizado' };
          }

          const { verifyToken } = await import('@/utils/security');
          const payload = verifyToken(token);
          if (!payload || !payload.participant_id) {
            set.status = 401;
            return { success: false, error: 'Token inválido' };
          }

          const { filePath, fileName } = await downloadSample(params.id, payload.participant_id);
          set.headers['Content-Type'] = 'application/zip';
          set.headers['Content-Disposition'] = `attachment; filename="${fileName}"`;
          return Bun.file(filePath);
        } catch (error: any) {
          set.status = 404;
          return { success: false, error: error.message || 'Arquivo não encontrado' };
        }
      })
      // Rotas de resultados
      .post('/api/results', async ({ body, headers }: any) => {
        const authHeader = headers['authorization'];
        if (!authHeader) {
          return { success: false, error: 'Não autorizado' };
        }
        const token = authHeader.replace('Bearer ', '');

        // Extrai participantId do token
        const { verifyToken } = await import('@/utils/security');
        const payload = verifyToken(token);
        if (!payload || !payload.participant_id) {
          return { success: false, error: 'Token inválido' };
        }

        return await resultController.submitGroupResult(payload.participant_id, body);
      })
      .get('/api/results/sample/:sampleId', async ({ params, headers }: any) => {
        const authHeader = headers['authorization'];
        if (!authHeader) {
          return { success: false, error: 'Não autorizado' };
        }
        const token = authHeader.replace('Bearer ', '');
        const { verifyToken } = await import('@/utils/security');
        const payload = verifyToken(token);
        if (!payload || !payload.participant_id) {
          return { success: false, error: 'Token inválido' };
        }
        return await resultController.getSampleResults(payload.participant_id, params.sampleId);
      })
      // Rotas de minúcias
      .get('/api/minutiae/:groupId/:imageType/:imageIndex', async ({ params, headers }: any) => {
        const authHeader = headers['authorization'];
        if (!authHeader) {
          return { success: false, error: 'Não autorizado' };
        }
        const token = authHeader.replace('Bearer ', '');
        const { verifyToken } = await import('@/utils/security');
        const payload = verifyToken(token);
        if (!payload || !payload.participant_id) {
          return { success: false, error: 'Token inválido' };
        }
        const imageIndex = params.imageIndex === 'null' ? null : parseInt(params.imageIndex);
        return await resultController.getMinutiaeMarkings(
          payload.participant_id, params.groupId, params.imageType, imageIndex
        );
      })
      .post('/api/minutiae', async ({ body, headers }: any) => {
        const authHeader = headers['authorization'];
        if (!authHeader) {
          return { success: false, error: 'Não autorizado' };
        }
        const token = authHeader.replace('Bearer ', '');
        const { verifyToken } = await import('@/utils/security');
        const payload = verifyToken(token);
        if (!payload || !payload.participant_id) {
          return { success: false, error: 'Token inválido' };
        }
        return await resultController.addMinutiaeMarking(payload.participant_id, body);
      })
      .delete('/api/minutiae/:id', async ({ params, headers }: any) => {
        const authHeader = headers['authorization'];
        if (!authHeader) {
          return { success: false, error: 'Não autorizado' };
        }
        const token = authHeader.replace('Bearer ', '');
        const { verifyToken } = await import('@/utils/security');
        const payload = verifyToken(token);
        if (!payload || !payload.participant_id) {
          return { success: false, error: 'Token inválido' };
        }
        return await resultController.removeMinutiaeMarking(payload.participant_id, params.id);
      })
      // Rota de download do certificado
      .get('/api/certificate/download', async ({ headers, query, set }: any) => {
        try {
          const authHeader = headers['authorization'];
          if (!authHeader) {
            set.status = 401;
            return { success: false, error: 'Não autorizado' };
          }
          const token = authHeader.replace('Bearer ', '');

          // Extrai participantId do token
          const { verifyToken } = await import('@/utils/security');
          const payload = verifyToken(token);
          if (!payload || !payload.participant_id) {
            set.status = 401;
            return { success: false, error: 'Token inválido' };
          }

          // Pega sample_id da query (opcional)
          const sampleId = query?.sample_id;

          // Busca certificado do participante
          const { queryOne } = await import('./database/db');

          let certificate;
          if (sampleId) {
            // Busca certificado específico da amostra
            certificate = queryOne<any>(
              'SELECT * FROM certificates WHERE participant_id = $participant_id AND sample_id = $sample_id ORDER BY issued_at DESC LIMIT 1',
              { participant_id: payload.participant_id, sample_id: sampleId }
            );
          } else {
            // Busca certificado mais recente
            certificate = queryOne<any>(
              'SELECT * FROM certificates WHERE participant_id = $participant_id ORDER BY issued_at DESC LIMIT 1',
              { participant_id: payload.participant_id }
            );
          }

          if (!certificate || !certificate.file_path) {
            set.status = 404;
            return { success: false, error: 'Certificado não encontrado' };
          }

          // Busca dados da amostra para o nome do arquivo
          const sample = queryOne<any>(
            'SELECT carry_code FROM samples WHERE id = $id',
            { id: certificate.sample_id }
          );

          const fileName = `certificado_${sample?.carry_code || 'participante'}.pdf`;

          set.headers['Content-Type'] = 'application/pdf';
          set.headers['Content-Disposition'] = `attachment; filename="${fileName}"`;

          return Bun.file(certificate.file_path);
        } catch (error: any) {
          logger.error('Erro ao baixar certificado', error);
          set.status = 500;
          return { success: false, error: error.message || 'Erro ao baixar certificado' };
        }
      })
      .listen({
        hostname: '0.0.0.0',
        port: env.PORT || 3000
      });

    logger.info(`Servidor rodando em http://0.0.0.0:${env.PORT || 3000}`);

    // Graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Encerrando servidor...');
      closeDatabase();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Erro ao iniciar servidor', error as Error);
    process.exit(1);
  }
}

startServer();
