#!/bin/bash

# Script para fazer backup do banco de dados e iniciar um novo
# Uso: ./scripts/backup-and-reset-db.sh

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Diretórios
DB_DIR="backend/data"
DB_FILE="$DB_DIR/fingerprint.db"
BACKUP_DIR="$DB_DIR/backups"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  Backup e Reset do Banco de Dados${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Verifica se o banco existe
if [ ! -f "$DB_FILE" ]; then
    echo -e "${YELLOW}⚠️  Banco de dados não encontrado em $DB_FILE${NC}"
    echo -e "${YELLOW}   Nenhum backup necessário.${NC}"
else
    # Cria diretório de backup se não existir
    mkdir -p "$BACKUP_DIR"

    # Gera nome do backup com timestamp
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="$BACKUP_DIR/fingerprint_backup_$TIMESTAMP.db"

    # Faz backup
    echo -e "${GREEN}📦 Criando backup...${NC}"
    cp "$DB_FILE" "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Backup criado: $BACKUP_FILE${NC}"
        
        # Mostra tamanho do backup
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        echo -e "${GREEN}  Tamanho: $BACKUP_SIZE${NC}"
    else
        echo -e "${RED}✗ Erro ao criar backup${NC}"
        exit 1
    fi
fi

# Pergunta confirmação para deletar banco atual
echo ""
echo -e "${YELLOW}⚠️  ATENÇÃO: Todos os dados atuais serão apagados!${NC}"
read -p "Deseja continuar e resetar o banco? (s/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo -e "${YELLOW}Operação cancelada pelo usuário.${NC}"
    exit 0
fi

# Remove banco atual e arquivos relacionados
echo ""
echo -e "${RED}🗑️  Removendo banco atual...${NC}"
rm -f "$DB_FILE" "$DB_FILE-shm" "$DB_FILE-wal"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Banco removido com sucesso${NC}"
else
    echo -e "${RED}✗ Erro ao remover banco${NC}"
    exit 1
fi

# Pergunta se quer reiniciar o backend
echo ""
read -p "Deseja reiniciar o backend agora? (S/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    echo -e "${GREEN}🔄 Parando backend...${NC}"
    pkill -9 -f "bun.*server-simple" 2>/dev/null
    sleep 1
    
    echo -e "${GREEN}🚀 Iniciando backend...${NC}"
    cd backend && bun run src/server-simple.ts > /tmp/backend.log 2>&1 &
    cd ..
    
    echo -e "${GREEN}⏳ Aguardando inicialização...${NC}"
    sleep 3
    
    # Verifica se backend está rodando
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend reiniciado com sucesso!${NC}"
        echo -e "${GREEN}  http://localhost:3000${NC}"
    else
        echo -e "${RED}✗ Erro ao iniciar backend${NC}"
        echo -e "${YELLOW}  Verifique os logs em /tmp/backend.log${NC}"
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Operação Concluída!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Lista backups disponíveis
if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR)" ]; then
    echo -e "${YELLOW}📋 Backups disponíveis:${NC}"
    ls -lh "$BACKUP_DIR" | grep -v "^total" | awk '{print "   " $9 " (" $5 ")"}'
    echo ""
fi

echo -e "${GREEN}✓ Novo banco será criado automaticamente no próximo acesso${NC}"
echo ""
