import { buscarRelatoriosVendas } from '../actions/relatorios';
import RelatoriosClient from './RelatoriosClient';

export const dynamic = 'force-dynamic';

export default async function RelatoriosPage() {
  const data = await buscarRelatoriosVendas('30d');
  return (
    <RelatoriosClient
      initialResumo={data.resumo}
      initialSemVisita={data.semVisita}
      initialSemCompra={data.semCompra}
      initialRanking={data.ranking}
    />
  );
}
