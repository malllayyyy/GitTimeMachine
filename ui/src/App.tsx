import { useState, useMemo, useEffect } from 'react';
import SubwayGraph from './components/SubwayGraph';
import CommitSidebar from './components/CommitSidebar';
import TimeScrubber from './components/TimeScrubber';
import './App.css';

interface GraphNode {
  id: string;
  author: string;
  timestamp: number;
  message: string;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function App() {
  const [repoPath, setRepoPath] = useState(window.localStorage.getItem('git_repo_path') || '');
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCommitIndex, setActiveCommitIndex] = useState(-1);
  const [selectedCommitId, setSelectedCommitId] = useState<string | null>(null);

  const sortedNodes = useMemo(() => {
    if (!graphData) return [];
    return [...graphData.nodes].sort((a, b) => a.timestamp - b.timestamp);
  }, [graphData]);

  const loadRepository = async (path: string) => {
    if (!path.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:3001/api/graph?repoPath=${encodeURIComponent(path)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch repository graph');
      }
      setGraphData(data);
      window.localStorage.setItem('git_repo_path', path);
      
      const nodesCount = data.nodes.length;
      setActiveCommitIndex(nodesCount - 1);
      if (nodesCount > 0) {
        const sorted = [...data.nodes].sort((a: any, b: any) => a.timestamp - b.timestamp);
        setSelectedCommitId(sorted[nodesCount - 1].id);
      }
    } catch (err) {
      setError((err as Error).message);
      setGraphData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repoPath) {
      loadRepository(repoPath);
    }
  }, []);

  const handleScrub = (index: number) => {
    setActiveCommitIndex(index);
    if (sortedNodes[index]) {
      setSelectedCommitId(sortedNodes[index].id);
    }
  };

  const handleCommitSelect = (id: string) => {
    setSelectedCommitId(id);
    const index = sortedNodes.findIndex(n => n.id === id);
    if (index !== -1) {
      setActiveCommitIndex(index);
    }
  };

  const selectedNode = selectedCommitId 
    ? sortedNodes.find(n => n.id === selectedCommitId) || null 
    : (sortedNodes[activeCommitIndex] || null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadRepository(repoPath);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-group">
          <h1>Git Time Machine</h1>
          <p className="subtitle">Visual Repository Explorer</p>
        </div>
        <form onSubmit={handleSubmit} className="explorer-form">
          <input
            type="text"
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            placeholder="Type absolute path to a local Git repository..."
            className="explorer-input"
          />
          <button type="submit" className="explorer-btn" disabled={loading}>
            {loading ? 'Loading...' : 'Explore'}
          </button>
        </form>
      </header>

      <div className="main-content">
        <div className="graph-area">
          {loading && (
            <div className="loading-container">
              <div className="spinner"></div>
              <p style={{ marginTop: '16px' }}>Decompressing and parsing Git history...</p>
            </div>
          )}
          
          {error && (
            <div className="error-container">
              <h3>Oops! Something went wrong</h3>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && !graphData && (
            <div className="welcome-container">
              <h2>Welcome to Git Time Machine</h2>
              <p>Type the absolute folder path of a Git repository above to begin manually traversing its history graph!</p>
            </div>
          )}

          {!loading && !error && graphData && (
            <SubwayGraph 
              nodes={graphData.nodes} 
              edges={graphData.edges} 
              activeCommitIndex={activeCommitIndex}
              onCommitSelect={handleCommitSelect}
            />
          )}
        </div>
        <CommitSidebar commit={selectedNode} />
      </div>

      {graphData && sortedNodes.length > 0 && (
        <TimeScrubber 
          totalCommits={sortedNodes.length} 
          currentIndex={activeCommitIndex} 
          onChange={handleScrub} 
        />
      )}
    </div>
  );
}

export default App;
