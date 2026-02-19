#!/usr/bin/env python3
"""
Script de Análise de Resultados do Teste de Proficiência
Autor: Sistema de Teste de Proficiência - FAPEMIG RED-00120-23
Data: 2024

Este script analisa os resultados armazenados no banco de dados SQLite e gera
uma tabela CSV com todas as métricas de avaliação, incluindo:
- Verdadeiros Positivos (TP)
- Verdadeiros Negativos (TN)
- Falsos Positivos (FP)
- Falsos Negativos (FN)
"""

import sqlite3
import pandas as pd
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import argparse
from datetime import datetime

class ResultsAnalyzer:
    """Analisador de resultados do teste de proficiência"""

    def __init__(self, db_path: str):
        """
        Inicializa o analisador

        Args:
            db_path: Caminho para o banco de dados SQLite
        """
        self.db_path = Path(db_path)
        if not self.db_path.exists():
            raise FileNotFoundError(f"Banco de dados não encontrado: {db_path}")

        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row

    def __del__(self):
        """Fecha conexão com o banco ao destruir o objeto"""
        if hasattr(self, 'conn'):
            self.conn.close()

    def get_quality_from_cache(self, filename: str) -> Optional[int]:
        """
        Obtém a qualidade da imagem do cache de comparações pareadas

        Args:
            filename: Nome do arquivo de imagem

        Returns:
            Qualidade da imagem ou None se não encontrada
        """
        cursor = self.conn.cursor()

        # Tenta primeiro como arquivo_a
        cursor.execute("""
            SELECT quali_a FROM pairwise_cache
            WHERE arquivo_a = ?
            LIMIT 1
        """, (filename,))

        result = cursor.fetchone()
        if result:
            return result['quali_a']

        # Tenta como arquivo_b
        cursor.execute("""
            SELECT quali_b FROM pairwise_cache
            WHERE arquivo_b = ?
            LIMIT 1
        """, (filename,))

        result = cursor.fetchone()
        if result:
            return result['quali_b']

        return None

    def calculate_metrics(self,
                         has_same_source: bool,
                         true_match_index: Optional[int],
                         conclusive: bool,
                         has_match: Optional[bool],
                         matched_image_index: Optional[int]) -> Dict[str, int]:
        """
        Calcula as métricas de avaliação (TP, TN, FP, FN)

        Args:
            has_same_source: Se o grupo tem correspondência verdadeira
            true_match_index: Índice da correspondência verdadeira (0-9)
            conclusive: Se a resposta foi conclusiva
            has_match: Se o participante identificou correspondência
            matched_image_index: Índice da imagem identificada (0-9)

        Returns:
            Dicionário com as métricas calculadas
        """
        metrics = {
            'conclusivo': 1 if conclusive else 0,
            'identificou': 0,
            'verdadeiro_positivo': 0,
            'verdadeiro_negativo': 0,
            'falso_positivo': 0,
            'falso_negativo': 0
        }

        # Se não foi conclusivo, retorna zeros
        if not conclusive:
            return metrics

        # Marca se identificou correspondência
        if has_match is not None:
            metrics['identificou'] = 1 if has_match else 0

        # Calcula TP, TN, FP, FN
        if has_same_source:
            # Existe correspondência verdadeira no grupo
            if has_match:
                # Participante disse que há match
                if matched_image_index == true_match_index:
                    # Acertou a imagem correta
                    metrics['verdadeiro_positivo'] = 1
                else:
                    # Identificou match mas na imagem errada
                    metrics['falso_positivo'] = 1
            else:
                # Participante disse que NÃO há match (mas existe)
                metrics['falso_negativo'] = 1
        else:
            # NÃO existe correspondência verdadeira no grupo
            if has_match:
                # Participante disse que há match (mas não existe)
                metrics['falso_positivo'] = 1
            else:
                # Participante disse que NÃO há match (correto)
                metrics['verdadeiro_negativo'] = 1

        return metrics

    def extract_results(self) -> pd.DataFrame:
        """
        Extrai todos os resultados do banco de dados

        Returns:
            DataFrame com todos os resultados e métricas
        """
        cursor = self.conn.cursor()

        # Query complexa que junta todas as tabelas necessárias
        query = """
        SELECT
            p.voluntary_code AS codigo_participante,
            p.voluntary_name AS nome_participante,
            p.carry_code AS codigo_amostra,
            s.id AS sample_id,
            g.id AS group_id,
            g.group_id AS codigo_grupo,
            g.group_index AS indice_grupo,
            g.has_same_source,
            g.questionada_filename AS arquivo_questionada,
            g.padroes_filenames AS arquivos_padroes,
            g.matched_image_index AS indice_verdadeiro,
            g.status AS status_grupo,
            r.conclusive,
            r.has_match,
            r.matched_image_index AS indice_respondido,
            r.compatibility_degree AS grau_compatibilidade,
            r.notes AS observacoes,
            r.submitted_at AS data_submissao
        FROM results r
        INNER JOIN groups g ON r.group_id = g.id
        INNER JOIN samples s ON r.sample_id = s.id
        INNER JOIN participants p ON s.participant_id = p.id
        ORDER BY p.voluntary_code, s.id, g.group_index
        """

        cursor.execute(query)
        rows = cursor.fetchall()

        if not rows:
            print("⚠️  Nenhum resultado encontrado no banco de dados")
            return pd.DataFrame()

        # Converte para lista de dicionários
        data = []
        for row in rows:
            row_dict = dict(row)

            # Extrai qualidade da imagem questionada
            qualidade = self.get_quality_from_cache(row_dict['arquivo_questionada'])
            row_dict['qualidade_questionada'] = qualidade if qualidade is not None else 0

            # Calcula métricas
            metrics = self.calculate_metrics(
                has_same_source=bool(row_dict['has_same_source']),
                true_match_index=row_dict['indice_verdadeiro'],
                conclusive=bool(row_dict['conclusive']),
                has_match=bool(row_dict['has_match']) if row_dict['has_match'] is not None else None,
                matched_image_index=row_dict['indice_respondido']
            )

            # Adiciona métricas ao dicionário
            row_dict.update(metrics)

            # Ajusta grau de compatibilidade (0 se não respondeu)
            if row_dict['grau_compatibilidade'] is None:
                row_dict['grau_compatibilidade'] = 0

            data.append(row_dict)

        # Cria DataFrame
        df = pd.DataFrame(data)

        # Reordena colunas para melhor visualização
        column_order = [
            'codigo_participante',
            'codigo_amostra',
            'codigo_grupo',
            'has_same_source',
            'indice_verdadeiro',
            'qualidade_questionada',
            'conclusivo',
            'identificou',
            'indice_respondido',
            'verdadeiro_positivo',
            'verdadeiro_negativo',
            'falso_positivo',
            'falso_negativo',
            'grau_compatibilidade',
            'data_submissao',
            'observacoes'
        ]

        # Reordena apenas as colunas que existem
        existing_columns = [col for col in column_order if col in df.columns]
        df = df[existing_columns]

        return df

    def generate_summary_statistics(self, df: pd.DataFrame) -> Dict:
        """
        Gera estatísticas resumidas dos resultados

        Args:
            df: DataFrame com os resultados

        Returns:
            Dicionário com estatísticas
        """
        if df.empty:
            return {}

        stats = {
            'total_participantes': df['codigo_participante'].nunique(),
            'total_amostras': df['codigo_amostra'].nunique(),
            'total_grupos_avaliados': len(df),
            'total_conclusivos': df['conclusivo'].sum(),
            'total_inconclusivos': len(df) - df['conclusivo'].sum(),
            'total_com_match': df['identificou'].sum(),
            'total_sem_match': (df['conclusivo'] == 1).sum() - df['identificou'].sum(),
            'total_verdadeiros_positivos': df['verdadeiro_positivo'].sum(),
            'total_verdadeiros_negativos': df['verdadeiro_negativo'].sum(),
            'total_falsos_positivos': df['falso_positivo'].sum(),
            'total_falsos_negativos': df['falso_negativo'].sum(),
        }

        # Calcula taxas
        total_conclusivos = stats['total_conclusivos']
        if total_conclusivos > 0:
            stats['taxa_conclusivos'] = (total_conclusivos / len(df)) * 100
            stats['taxa_verdadeiros_positivos'] = (stats['total_verdadeiros_positivos'] / total_conclusivos) * 100
            stats['taxa_verdadeiros_negativos'] = (stats['total_verdadeiros_negativos'] / total_conclusivos) * 100
            stats['taxa_falsos_positivos'] = (stats['total_falsos_positivos'] / total_conclusivos) * 100
            stats['taxa_falsos_negativos'] = (stats['total_falsos_negativos'] / total_conclusivos) * 100

        # Calcula acurácia
        total_corretos = stats['total_verdadeiros_positivos'] + stats['total_verdadeiros_negativos']
        if total_conclusivos > 0:
            stats['acuracia'] = (total_corretos / total_conclusivos) * 100

        return stats

    def export_to_csv(self, df: pd.DataFrame, output_path: str):
        """
        Exporta DataFrame para CSV

        Args:
            df: DataFrame com os resultados
            output_path: Caminho do arquivo CSV de saída
        """
        output_file = Path(output_path)
        df.to_csv(output_file, index=False, encoding='utf-8-sig')
        print(f"✅ Resultados exportados para: {output_file}")
        print(f"📊 Total de registros: {len(df)}")

    def export_to_excel(self, df: pd.DataFrame, output_path: str):
        """
        Exporta DataFrame para Excel com formatação

        Args:
            df: DataFrame com os resultados
            output_path: Caminho do arquivo Excel de saída
        """
        try:
            output_file = Path(output_path)

            with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
                # Aba principal com os dados
                df.to_excel(writer, sheet_name='Resultados', index=False)

                # Aba com estatísticas
                stats = self.generate_summary_statistics(df)
                if stats:
                    stats_df = pd.DataFrame([stats]).T
                    stats_df.columns = ['Valor']
                    stats_df.to_excel(writer, sheet_name='Estatísticas')

            print(f"✅ Resultados exportados para: {output_file}")
            print(f"📊 Total de registros: {len(df)}")
        except ImportError:
            print("⚠️  Biblioteca 'openpyxl' não encontrada. Instale com: pip install openpyxl")
            print("📝 Exportando apenas para CSV...")
            self.export_to_csv(df, output_path.replace('.xlsx', '.csv'))


def main():
    """Função principal"""
    parser = argparse.ArgumentParser(
        description='Analisa resultados do teste de proficiência em papiloscopia',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos de uso:
  python analyze_results.py
  python analyze_results.py --db ../backend/data/fingerprint.db
  python analyze_results.py --output resultados_2024.csv
  python analyze_results.py --format excel
  python analyze_results.py --stats-only
        """
    )

    parser.add_argument(
        '--db',
        type=str,
        default='../backend/data/fingerprint.db',
        help='Caminho para o banco de dados SQLite (padrão: ../backend/data/fingerprint.db)'
    )

    parser.add_argument(
        '--output',
        type=str,
        default=None,
        help='Caminho para o arquivo de saída (padrão: resultados_YYYYMMDD_HHMMSS.csv)'
    )

    parser.add_argument(
        '--format',
        type=str,
        choices=['csv', 'excel'],
        default='csv',
        help='Formato de saída (padrão: csv)'
    )

    parser.add_argument(
        '--stats-only',
        action='store_true',
        help='Exibe apenas estatísticas sem exportar arquivo'
    )

    args = parser.parse_args()

    # Banner
    print("=" * 70)
    print("📊 ANÁLISE DE RESULTADOS - TESTE DE PROFICIÊNCIA")
    print("   Projeto: Avaliação de Métodos de Comparação Forense")
    print("   Apoio: FAPEMIG e Rede Mineira de Ciências Forenses")
    print("   Projeto: RED-00120-23")
    print("=" * 70)
    print()

    try:
        # Inicializa analisador
        print(f"🔍 Conectando ao banco de dados: {args.db}")
        analyzer = ResultsAnalyzer(args.db)

        # Extrai resultados
        print("📥 Extraindo resultados...")
        df = analyzer.extract_results()

        if df.empty:
            print("❌ Nenhum resultado encontrado no banco de dados")
            return

        # Gera estatísticas
        print("\n📈 ESTATÍSTICAS GERAIS")
        print("-" * 70)
        stats = analyzer.generate_summary_statistics(df)

        for key, value in stats.items():
            label = key.replace('_', ' ').title()
            if 'taxa' in key or 'acuracia' in key:
                print(f"  {label:<40} {value:>8.2f}%")
            else:
                print(f"  {label:<40} {value:>8}")

        # Se apenas estatísticas, para aqui
        if args.stats_only:
            return

        # Define nome do arquivo de saída
        if args.output is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            if args.format == 'excel':
                output_path = f'resultados_{timestamp}.xlsx'
            else:
                output_path = f'resultados_{timestamp}.csv'
        else:
            output_path = args.output

        # Exporta
        print(f"\n💾 Exportando resultados...")
        if args.format == 'excel':
            analyzer.export_to_excel(df, output_path)
        else:
            analyzer.export_to_csv(df, output_path)

        print("\n✅ Análise concluída com sucesso!")

    except FileNotFoundError as e:
        print(f"❌ Erro: {e}")
    except Exception as e:
        print(f"❌ Erro inesperado: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
