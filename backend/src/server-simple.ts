import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { env } from './config/env';
import { initializeDatabase, closeDatabase } from './database/db';
import { logger } from './middleware/logger';

// Controllers
import * as authController from './controllers/authController';
import * as resultController from './controllers/resultController';
import * as sampleController from './controllers/sampleController';

async function startServer() {
  try {
    // Inicializa banco de dados
    initializeDatabase();
    logger.info('Banco de dados inicializado');

    // Cria aplicação Elysia
    const app = new Elysia()
      .use(cors({
        origin: env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true
      }))
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
      // Rotas de autenticação
      .post('/api/auth/register', async ({ body }: any) => {
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
      .post('/api/auth/login', async ({ body }: any) => {
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
      .post('/api/auth/validate-email', async ({ body }: any) => {
        return await authController.validateEmail(body);
      })
      .post('/api/auth/validate-code', async ({ body }: any) => {
        return await authController.validateCode(body);
      })
      .post('/api/auth/forgot-code', async ({ body }: any) => {
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
        return await sampleController.getSampleById({ token, sample_id: params.id });
      })
      .get('/api/samples/:id/progress', async ({ params, headers }: any) => {
        const authHeader = headers['authorization'];
        if (!authHeader) {
          return { success: false, error: 'Não autorizado' };
        }
        const token = authHeader.replace('Bearer ', '');
        return await sampleController.getSampleProgress({ token, sample_id: params.id });
      })
      // Rotas de grupos
      .get('/api/groups/:id', async ({ params, headers }: any) => {
        const authHeader = headers['authorization'];
        if (!authHeader) {
          return { success: false, error: 'Não autorizado' };
        }
        const token = authHeader.replace('Bearer ', '');
        return await sampleController.getGroupById({ token, group_id: params.id });
      })
      // Rotas de resultados
      .post('/api/results', async ({ body, headers }: any) => {
        const authHeader = headers['authorization'];
        if (!authHeader) {
          return { success: false, error: 'Não autorizado' };
        }
        const token = authHeader.replace('Bearer ', '');
        return await resultController.submitResult({ token, ...body });
      })
      .listen(env.PORT || 3000);

    logger.info(`Servidor rodando em http://localhost:${env.PORT || 3000}`);

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
