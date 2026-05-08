import { buscarRelatorios } from '../actions/relatorios';
import RelatoriosClient from './RelatoriosClient';

export const dynamic = 'force-dynamic';

export default async function RelatoriosPage() {
  const data = await buscarRelatorios();
  return <RelatoriosClient kpi={data.kpi} cidades={data.cidades} />;
}
