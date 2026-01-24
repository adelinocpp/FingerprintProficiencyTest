import Elysia from 'elysia';
import { env, validateEnv } from '@config/env';
import { initializeDatabase, closeDatabase } from '@database/db';
import { logger } from '@middleware/logger';
import { createErrorHandlerMiddleware } from '@middleware/errorHandler';
import { createAuthMiddleware, requireAuth, securityHeaders } from '@middleware/auth';
import { createLoggingMiddleware, logAccess } from '@middleware/logger';

// Controllers
import * as authController from '@controllers/authController';
import * as resultController from '@controllers/resultController';
import * as sampleController from '@controllers/sampleController';

/**
 * Inicializa servidor
 */
async function startServer() {
  try {
    // Valida variáveis de ambiente
    validateEnv();

    // Inicializa banco de dados
    initializeDatabase();

    // Cria aplicação Elysia
    const app = new Elysia()
      .use(securityHeaders())
      .use(createLoggingMiddleware())
      .use(createErrorHandlerMiddleware());

    // Rotas de saúde
    app.get('/health', () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    }));

    // Rotas de autenticação
    app.post('/api/auth/register', async ({ body, request, set }) => {
      try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';
        
        const result = await authController.registerParticipant(body);
        
        logAccess(null, ip, '/api/auth/register', 'POST', 201, userAgent);
        set.status = 201;
        return result;
      } catch (error) {
        throw error;
      }
    });

    app.post('/api/auth/login', async ({ body, request, set }) => {
      try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';
        
        const result = await authController.loginParticipant(body);
        
        logAccess(null, ip, '/api/auth/login', 'POST', 200, userAgent);
        return result;
      } catch (error) {
        throw error;
      }
    });

    app.get('/api/auth/check-email', async ({ query, request }) => {
      try {
        const email = query.email as string;
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';
        
        const result = await authController.checkEmailExists(email);
        
        logAccess(null, ip, '/api/auth/check-email', 'GET', 200, userAgent);
        return result;
      } catch (error) {
        throw error;
      }
    });

    app.get('/api/auth/check-code', async ({ query, request }) => {
      try {
        const code = query.code as string;
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';
        
        const result = await authController.checkCodeExists(code);
        
        logAccess(null, ip, '/api/auth/check-code', 'GET', 200, userAgent);
        return result;
      } catch (error) {
        throw error;
      }
    });

    // Rotas protegidas - Participante
    app.get('/api/participant/me', 
      async ({ request, set }) => {
        try {
          const authHeader = request.headers.get('authorization');
          if (!authHeader) {
            set.status = 401;
            return { success: false, error: 'Não autorizado' };
          }

          const token = authHeader.split(' ')[1];
          const { verifyToken } = await import('@utils/security');
          const payload = verifyToken(token);

          if (!payload) {
            set.status = 401;
            return { success: false, error: 'Token inválido' };
          }

          const result = await authController.getParticipant(payload.participant_id);
          
          const ip = request.headers.get('x-forwarded-for') || 'unknown';
          const userAgent = request.headers.get('user-agent') || 'unknown';
          logAccess(payload.participant_id, ip, '/api/participant/me', 'GET', 200, userAgent);
          
          return result;
        } catch (error) {
          throw error;
        }
      }
    );

    app.put('/api/participant/me',
      async ({ request, body, set }) => {
        try {
          const authHeader = request.headers.get('authorization');
          if (!authHeader) {
            set.status = 401;
            return { success: false, error: 'Não autorizado' };
          }

          const token = authHeader.split(' ')[1];
          const { verifyToken } = await import('@utils/security');
          const payload = verifyToken(token);

          if (!payload) {
            set.status = 401;
            return { success: false, error: 'Token inválido' };
          }

          const result = await authController.updateParticipant(payload.participant_id, body);
          
          const ip = request.headers.get('x-forwarded-for') || 'unknown';
          const userAgent = request.headers.get('user-agent') || 'unknown';
          logAccess(payload.participant_id, ip, '/api/participant/me', 'PUT', 200, userAgent);
          
          return result;
        } catch (error) {
          throw error;
        }
      }
    );

    // Rotas de amostras
    app.get('/api/samples',
      async ({ request, set }) => {
        try {
          const authHeader = request.headers.get('authorization');
          if (!authHeader) {
            set.status = 401;
            return { success: false, error: 'Não autorizado' };
          }

          const token = authHeader.split(' ')[1];
          const { verifyToken } = await import('@utils/security');
          const payload = verifyToken(token);

          if (!payload) {
            set.status = 401;
            return { success: false, error: 'Token inválido' };
          }

          const result = await sampleController.getParticipantSamples(payload.participant_id);
          
          const ip = request.headers.get('x-forwarded-for') || 'unknown';
          const userAgent = request.headers.get('user-agent') || 'unknown';
          logAccess(payload.participant_id, ip, '/api/samples', 'GET', 200, userAgent);
          
          return result;
        } catch (error) {
          throw error;
        }
      }
    );

    app.get('/api/samples/:sampleId',
      async ({ request, params, set }) => {
        try {
          const authHeader = request.headers.get('authorization');
          if (!authHeader) {
            set.status = 401;
            return { success: false, error: 'Não autorizado' };
          }

          const token = authHeader.split(' ')[1];
          const { verifyToken } = await import('@utils/security');
          const payload = verifyToken(token);

          if (!payload) {
            set.status = 401;
            return { success: false, error: 'Token inválido' };
          }

          const result = await sampleController.getSampleDetails(payload.participant_id, params.sampleId);
          
          const ip = request.headers.get('x-forwarded-for') || 'unknown';
          const userAgent = request.headers.get('user-agent') || 'unknown';
          logAccess(payload.participant_id, ip, '/api/samples/:sampleId', 'GET', 200, userAgent);
          
          return result;
        } catch (error) {
          throw error;
        }
      }
    );

    app.get('/api/samples/:sampleId/progress',
      async ({ request, params, set }) => {
        try {
          const authHeader = request.headers.get('authorization');
          if (!authHeader) {
            set.status = 401;
            return { success: false, error: 'Não autorizado' };
          }

          const token = authHeader.split(' ')[1];
          const { verifyToken } = await import('@utils/security');
          const payload = verifyToken(token);

          if (!payload) {
            set.status = 401;
            return { success: false, error: 'Token inválido' };
          }

          const result = await sampleController.getSampleProgress(payload.participant_id, params.sampleId);
          
          const ip = request.headers.get('x-forwarded-for') || 'unknown';
          const userAgent = request.headers.get('user-agent') || 'unknown';
          logAccess(payload.participant_id, ip, '/api/samples/:sampleId/progress', 'GET', 200, userAgent);
          
          return result;
        } catch (error) {
          throw error;
        }
      }
    );

    // Rotas de grupos
    app.get('/api/groups/:groupId',
      async ({ request, params, set }) => {
        try {
          const authHeader = request.headers.get('authorization');
          if (!authHeader) {
            set.status = 401;
            return { success: false, error: 'Não autorizado' };
          }

          const token = authHeader.split(' ')[1];
          const { verifyToken } = await import('@utils/security');
          const payload = verifyToken(token);

          if (!payload) {
            set.status = 401;
            return { success: false, error: 'Token inválido' };
          }

          const result = await sampleController.getGroupDetails(payload.participant_id, params.groupId);
          
          const ip = request.headers.get('x-forwarded-for') || 'unknown';
          const userAgent = request.headers.get('user-agent') || 'unknown';
          logAccess(payload.participant_id, ip, '/api/groups/:groupId', 'GET', 200, userAgent);
          
          return result;
        } catch (error) {
          throw error;
        }
      }
    );

    // Rotas de resultados
    app.post('/api/results/submit',
      async ({ request, body, set }) => {
        try {
          const authHeader = request.headers.get('authorization');
          if (!authHeader) {
            set.status = 401;
            return { success: false, error: 'Não autorizado' };
          }

          const token = authHeader.split(' ')[1];
          const { verifyToken } = await import('@utils/security');
          const payload = verifyToken(token);

          if (!payload) {
            set.status = 401;
            return { success: false, error: 'Token inválido' };
          }

          const result = await resultController.submitGroupResult(payload.participant_id, body);
          
          const ip = request.headers.get('x-forwarded-for') || 'unknown';
          const userAgent = request.headers.get('user-agent') || 'unknown';
          logAccess(payload.participant_id, ip, '/api/results/submit', 'POST', 201, userAgent);
          
          set.status = 201;
          return result;
        } catch (error) {
          throw error;
        }
      }
    );

    app.get('/api/results/statistics',
      async ({ request, set }) => {
        try {
          const authHeader = request.headers.get('authorization');
          if (!authHeader) {
            set.status = 401;
            return { success: false, error: 'Não autorizado' };
          }

          const token = authHeader.split(' ')[1];
          const { verifyToken } = await import('@utils/security');
          const payload = verifyToken(token);

          if (!payload) {
            set.status = 401;
            return { success: false, error: 'Token inválido' };
          }

          const result = await resultController.getResultsStatistics(payload.participant_id);
          
          const ip = request.headers.get('x-forwarded-for') || 'unknown';
          const userAgent = request.headers.get('user-agent') || 'unknown';
          logAccess(payload.participant_id, ip, '/api/results/statistics', 'GET', 200, userAgent);
          
          return result;
        } catch (error) {
          throw error;
        }
      }
    );

    // Inicia servidor
    app.listen(env.PORT, () => {
      logger.info(`Servidor iniciado em http://localhost:${env.PORT}`, {
        environment: env.NODE_ENV,
        port: env.PORT,
      });
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Encerrando servidor...');
      closeDatabase();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Encerrando servidor...');
      closeDatabase();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Erro ao iniciar servidor', error as Error);
    process.exit(1);
  }
}

// Inicia servidor
startServer();
