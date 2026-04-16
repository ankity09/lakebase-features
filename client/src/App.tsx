import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Shell from './components/layout/Shell';
import ToastContainer from './components/shared/Toast';
import Overview from './components/features/Overview';
import CrudOperations from './components/features/CrudOperations';
import QueryEditor from './components/features/QueryEditor';
import DataSync from './components/features/DataSync';
import Branching from './components/features/Branching';
import Autoscaling from './components/features/Autoscaling';
import ScaleToZero from './components/features/ScaleToZero';
import ReadReplicas from './components/features/ReadReplicas';
import FeatureStore from './components/features/FeatureStore';
import PgvectorSearch from './components/features/PgvectorSearch';
import Monitoring from './components/features/Monitoring';

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/crud" element={<CrudOperations />} />
          <Route path="/query" element={<QueryEditor />} />
          <Route path="/sync" element={<DataSync />} />
          <Route path="/branching" element={<Branching />} />
          <Route path="/autoscaling" element={<Autoscaling />} />
          <Route path="/scale-to-zero" element={<ScaleToZero />} />
          <Route path="/replicas" element={<ReadReplicas />} />
          <Route path="/feature-store" element={<FeatureStore />} />
          <Route path="/pgvector" element={<PgvectorSearch />} />
          <Route path="/monitoring" element={<Monitoring />} />
        </Routes>
      </Shell>
      <ToastContainer />
    </BrowserRouter>
  );
}
