import ExcelUpload from '../components/ExcelUpload'
import { useDashboard } from '../context/DashboardContext'

/** Carga diaria de Excel — /dashboard/excel */
export default function ExcelUploadPage() {
  const { loadDash, setImportedToday, setHasStores, goTo } = useDashboard()

  return (
    <ExcelUpload
      onImported={() => { setImportedToday(true); setHasStores(true); loadDash() }}
      onDashboard={() => goTo('dashboard')}
    />
  )
}
