# Scripts do Sistema

## backup-and-reset-db.sh

Script para fazer backup do banco de dados SQLite e iniciar um novo banco limpo.

### Uso

```bash
./scripts/backup-and-reset-db.sh
```

### O que o script faz:

1. **Backup Automático**: Cria uma cópia do banco atual em `backend/data/backups/`
   - Formato: `fingerprint_backup_YYYYMMDD_HHMMSS.db`
   - Mostra tamanho do backup criado

2. **Confirmação de Segurança**: Pede confirmação antes de apagar dados

3. **Reset do Banco**: Remove o banco atual e arquivos relacionados (.db, .db-shm, .db-wal)

4. **Reinício Opcional**: Oferece reiniciar o backend automaticamente

5. **Lista Backups**: Mostra todos os backups disponíveis ao final

### Exemplos de Uso

#### Backup e Reset Completo
```bash
./scripts/backup-and-reset-db.sh
# Confirmar reset: s
# Confirmar restart: s
```

#### Apenas Backup (cancelar reset)
```bash
./scripts/backup-and-reset-db.sh
# Confirmar reset: n
```

### Restaurar um Backup

Para restaurar um backup específico:

```bash
# Parar o backend
pkill -9 -f "bun.*server-simple"

# Restaurar backup
cp backend/data/backups/fingerprint_backup_20260125_150000.db backend/data/fingerprint.db

# Reiniciar backend
cd backend && bun run src/server-simple.ts &
```

### Localização dos Backups

Os backups ficam salvos em:
```
backend/data/backups/
```

### Notas Importantes

- ⚠️ O reset é irreversível (sem o backup)
- ✓ Sempre cria backup antes de deletar
- ✓ Backups ficam salvos permanentemente
- ✓ Novo banco é criado automaticamente na próxima inicialização
