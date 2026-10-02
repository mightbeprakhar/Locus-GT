/**
 * @file App.jsx
 * @description Root application component for LOCUS: Spatial Game Theory Laboratory.
 * Configures the router, application shell, and primary route hierarchy.
 */

import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ClassicLab from './pages/ClassicLab.jsx';
import Frontier from './pages/Frontier.jsx';
import Experiments from './pages/Experiments.jsx';
import Insights from './pages/Insights.jsx';
import About from './pages/About.jsx';

/**
 * Route declarations for the LOCUS platform.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="classic" element={<ClassicLab />} />
        <Route path="frontier" element={<Frontier />} />
        <Route path="experiments" element={<Experiments />} />
        <Route path="insights" element={<Insights />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}

/**
 * @param {Object} props
 * @param {Array<string>} [props.initialEntries] - Optional route history for testing
 */
export default function App({ initialEntries }) {
  if (initialEntries) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <AppRoutes />
      </MemoryRouter>
    );
  }

  // Use BrowserRouter in browser DOM, MemoryRouter in SSR/test environments
  const Router = typeof document !== 'undefined' ? BrowserRouter : MemoryRouter;

  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
