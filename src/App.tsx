import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import ScoreLibrary from '@/pages/ScoreLibrary';
import RehearsalRoom from '@/pages/RehearsalRoom';
import RehearsalHall from '@/pages/RehearsalHall';
import PracticeRoom from '@/pages/PracticeRoom';
import VoicePartManager from '@/pages/VoicePartManager';
import AIAgent from '@/pages/AIAgent';
import TrainingPlans from '@/pages/TrainingPlans';
import Settings from '@/pages/Settings';
import SheetMusic from '@/pages/SheetMusic';
import ScoreEditor from '@/pages/ScoreEditor';
import WarmUpRoom from '@/pages/WarmUpRoom';

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/scores" element={<ScoreLibrary />} />
          <Route path="/rehearse/:id" element={<RehearsalRoom />} />
          <Route path="/hall" element={<RehearsalHall />} />
          <Route path="/practice" element={<PracticeRoom />} />
          <Route path="/voice-parts" element={<VoicePartManager />} />
          <Route path="/ai-agent" element={<AIAgent />} />
          <Route path="/plans" element={<TrainingPlans />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/sheet/:id" element={<SheetMusic />} />
          <Route path="/editor" element={<ScoreEditor />} />
          <Route path="/warmup" element={<WarmUpRoom />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
