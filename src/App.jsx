import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Zap, MessageSquare, ChevronRight, X, User, Package, 
  Clock, ShieldCheck, Database, FileText, Truck, Receipt, CreditCard, Box, Info
} from 'lucide-react';
import { NODE_TYPES, HIGHLIGHT_COLOR, HIGHLIGHT_WIDTH } from './constants';
import { useGraphData } from './hooks/useGraphData';

const SidebarCard = ({ icon: Icon, title, value, color }) => (
  <div className="card">
    <div className="card-title">{title}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {Icon && <Icon size={18} color={color || '#9ca3af'} />}
      <div style={{ fontSize: '1rem' }}>{value}</div>
    </div>
  </div>
);

export default function App() {
  const { graphData, isLoading, error: loadError } = useGraphData();
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [hoverNode, setHoverNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { type: 'ai', text: '👋 Welcome back! I am your SAP Order-to-Cash Auditor. Select a document or ask me a question to begin your analysis.' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const fgRef = useRef();

  useEffect(() => {
    if (loadError) {
      setChatMessages(prev => [...prev, { type: 'ai', text: `⚠️ Technical Error: ${loadError}` }]);
    }
  }, [loadError]);

  // Filtering / Search
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return [];
    return graphData.nodes.filter(n =>
      n.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.label && n.label.toLowerCase().includes(searchQuery.toLowerCase()))
    ).slice(0, 10);
  }, [graphData.nodes, searchQuery]);

  // Highlighting Logic
  const handleNodeClick = (node) => {
    setSelectedNode(node);

    // Recursive Trace Logic
    const hNodes = new Set([node.id]);
    const hLinks = new Set();

    const trace = (currNodeId, depth = 0) => {
      if (depth > 5) return; 

      graphData.links.forEach(link => {
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;

        if (sourceId === currNodeId && !hNodes.has(targetId)) {
          hNodes.add(targetId);
          hLinks.add(link);
          trace(targetId, depth + 1);
        } else if (targetId === currNodeId && !hNodes.has(sourceId)) {
          hNodes.add(sourceId);
          hLinks.add(link);
          trace(sourceId, depth + 1);
        }
      });
    };

    trace(node.id);
    setHighlightNodes(hNodes);
    setHighlightLinks(hLinks);

    if (fgRef.current) {
      const targetX = node.x !== undefined ? node.x : 0;
      const targetY = node.y !== undefined ? node.y : 0;
      fgRef.current.centerAt(targetX, targetY, 800);
      fgRef.current.zoom(2.2, 800);
    }
  };

  const handleSearchSelect = (node) => {
    setSearchQuery('');
    handleNodeClick(node);
    if (window.innerWidth <= 1024) {
      setIsSidebarOpen(false);
    }
  };

  const handleSendMessage = () => {
    const messageText = inputValue.trim();
    if (!messageText) return;

    const userMsg = { type: 'user', text: messageText };
    setChatMessages(prev => [...prev, userMsg]);
    setInputValue('');

    setTimeout(() => {
      let aiText = "I'm analyzing the SAP document flow for you. You can click on any node to see its full relationship chain.";
      const query = messageText.toLowerCase();

      const foundNode = graphData.nodes.find(n =>
        query.includes(n.id.toLowerCase()) ||
        (n.label && query.includes(n.label.toLowerCase()))
      );

      if (foundNode) {
        aiText = `I found the ${foundNode.type} ${foundNode.id}. ${foundNode.label ? `It is labeled as "${foundNode.label}".` : ''} I've highlighted its full O2C lifecycle in the graph for you.`;
        handleNodeClick(foundNode);
      } else if (query.includes('status') || query.includes('check')) {
        aiText = "To check the status of a document, please provide a Document ID or select one from the graph. I can trace and audit the entire document trail for you.";
      } else if (query.includes('hello') || query.includes('hi')) {
        aiText = "👋 Hello! I'm the Dodge AI Auditor. I'm ready to help you trace and audit SAP O2C flows across your entire system. What can I investigate for you?";
      }

      setChatMessages(prev => [...prev, { type: 'ai', text: aiText }]);
    }, 800);
  };

  const paintNode = useCallback((node, ctx, globalScale) => {
    const isHighlighted = highlightNodes.has(node.id) || (hoverNode === node);
    const isSelected = selectedNode === node;
    const typeConfig = NODE_TYPES[node.type] || { color: '#94a3b8' };

    const size = isSelected ? 8 : (isHighlighted ? 6 : 4.5);
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
    ctx.fillStyle = isHighlighted || isSelected ? '#ffffff' : typeConfig.color;
    ctx.fill();

    if (isHighlighted || isSelected) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = typeConfig.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (globalScale > 2) {
      const label = node.label || node.id;
      const fontSize = 12 / globalScale;
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(label, node.x, node.y + size + 4);
    }
  }, [highlightNodes, hoverNode, selectedNode]);

  if (isLoading) {
    return (
      <div style={{ height: '100dvh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
        <Zap size={48} color="#3b82f6" className="animate-pulse" />
        <div style={{ color: '#94a3b8', fontSize: '1.1rem', letterSpacing: '0.05em' }}>ANALYZING SAP DATA...</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <button className="menu-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Toggle sidebar">
        {isSidebarOpen ? <X size={20} /> : <Zap size={20} />}
      </button>

      {isSidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <header className="sidebar-header">
          <div className="logo">
            <Zap size={28} />
            DODGE AI
          </div>
          <div style={{ marginTop: '20px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#1c1c22', border: '1px solid #2d2d35', borderRadius: '8px', padding: '8px' }}>
              <Search size={18} color="#9ca3af" style={{ marginRight: '8px' }} />
              <input
                type="text"
                placeholder="Search documents..."
                style={{ background: 'none', border: 'none', color: '#fff', outline: 'none', width: '100%' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {filteredNodes.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1c1c22', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100, marginTop: '4px' }}>
                {filteredNodes.map(node => (
                  <div
                    key={node.id}
                    style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #2d2d35', fontSize: '0.875rem' }}
                    onClick={() => handleSearchSelect(node)}
                    onMouseEnter={() => setHoverNode(node)}
                    onMouseLeave={() => setHoverNode(null)}
                  >
                    <span style={{ color: NODE_TYPES[node.type]?.color, fontWeight: 'bold', marginRight: '8px' }}>{node.type}</span>
                    {node.id}
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        <section className="sidebar-content">
          <AnimatePresence mode="wait">
            {selectedNode ? (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                  <div style={{ background: NODE_TYPES[selectedNode.type]?.color, padding: '10px', borderRadius: '12px' }}>
                    {React.createElement(NODE_TYPES[selectedNode.type]?.icon || FileText, { size: 24, color: '#fff' })}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{selectedNode.type}</h2>
                    <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>{selectedNode.id}</p>
                  </div>
                </div>

                <SidebarCard title="Document Summary" value={selectedNode.label} color={NODE_TYPES[selectedNode.type]?.color} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <SidebarCard icon={User} title="Creator" value={selectedNode.createdByUser || 'N/A'} />
                  <SidebarCard icon={Clock} title="Date" value={selectedNode.creationDate ? new Date(selectedNode.creationDate).toLocaleDateString() : 'N/A'} />
                </div>

                <div className="card">
                  <div className="card-title">Audit Properties</div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.75rem', fontFamily: 'monospace', color: '#8b8b8b' }}>
                    <pre>{JSON.stringify(selectedNode, null, 2)}</pre>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ textAlign: 'center', marginTop: '100px' }}
              >
                <Info size={48} color="#2d2d35" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ color: '#9ca3af' }}>Select a node to view context</h3>
                <p style={{ color: '#4b5563', fontSize: '0.875rem', marginTop: '8px' }}>Explore the SAP O2C Graph to see document flow relationships.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <footer className="sidebar-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4b5563', fontSize: '0.75rem' }}>
            <span>Nodes: {graphData.nodes.length}</span>
            <span>Edges: {graphData.links.length}</span>
          </div>
        </footer>
      </aside>

      <main className="graph-container">
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          backgroundColor="transparent"
          nodeId="id"
          nodeColor={n => NODE_TYPES[n.type]?.color || '#4b5563'}
          nodeLabel={n => `${n.type}: ${n.id}\n${n.label}`}
          nodeCanvasObject={paintNode}
          linkWidth={link => highlightLinks.has(link) ? HIGHLIGHT_WIDTH : 1}
          linkDirectionalParticles={link => highlightLinks.has(link) ? 4 : 0}
          linkDirectionalParticleWidth={4}
          linkColor={link => highlightLinks.has(link) ? HIGHLIGHT_COLOR : '#2d2d35'}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          onNodeClick={handleNodeClick}
          onNodeHover={setHoverNode}
          d3AlphaDecay={0.05}
          d3VelocityDecay={0.2}
        />

        <div className="chat-overlay">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #2d2d35', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} color="#3b82f6" />
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Dodge AI Auditor</span>
            </div>
            <button
              onClick={() => setChatMessages([{ type: 'ai', text: 'Assistant reset. How can I help you today?' }])}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
              aria-label="Reset chat"
            >
              <X size={14} /> Reset
            </button>
          </div>
          <div className="chat-messages" id="chat-messages">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`message ${msg.type}`}>
                {msg.text}
              </div>
            ))}
          </div>
          <div className="chat-input-container">
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="chat-input"
                placeholder="Ask about document flow..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button
                onClick={handleSendMessage}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}
                aria-label="Send message"
              >
                <ChevronRight size={20} color="#3b82f6" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
