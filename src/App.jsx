import React, { useState, useEffect, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { 
  Search, 
  Database, 
  FileText, 
  Truck, 
  CreditCard, 
  User, 
  Package, 
  ChevronRight,
  Info,
  X,
  MessageSquare,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NODE_COLORS = {
  SalesOrder: '#3b82f6',
  Delivery: '#8b5cf6',
  Billing: '#f59e0b',
  JournalEntry: '#ef4444',
  Payment: '#10b981',
  Partner: '#9ca3af',
  Product: '#14b8a6',
  Default: '#4b5563'
};

const NODE_ICONS = {
  SalesOrder: FileText,
  Delivery: Truck,
  Billing: CreditCard,
  JournalEntry: Database,
  Payment: Zap,
  Partner: User,
  Product: Package
};

export default function App() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [hoverNode, setHoverNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { type: 'ai', text: 'Hello! I am your SAP Graph Assistant. How can I help you explore your Order-to-Cash data today?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  
  const fgRef = useRef();

  // Load Graph Data
  useEffect(() => {
    fetch('/data/graph_data.json')
      .then(res => res.json())
      .then(data => {
        // Enhance links for react-force-graph
        const enhancedLinks = data.links.map(link => ({
          ...link,
          source: link.source,
          target: link.target
        }));
        setGraphData({ nodes: data.nodes, links: enhancedLinks });
      })
      .catch(err => console.error("Error loading graph data:", err));
  }, []);

  // Filtering / Search
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return [];
    return graphData.nodes.filter(n => 
      n.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      n.label.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [graphData.nodes, searchQuery]);

  // Highlighting Logic
  const handleNodeClick = (node) => {
    setSelectedNode(node);
    
    // Recursive Trace Logic
    const hNodes = new Set([node.id]);
    const hLinks = new Set();
    
    const trace = (currNodeId, depth = 0) => {
      if (depth > 5) return; // Prevent infinite loops or too deep traces
      
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
    
    // Center camera with a small delay to ensure coordinates are stable
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
  };

  const handleSendMessage = () => {
    const messageText = inputValue.trim();
    if (!messageText) return;
    
    const userMsg = { type: 'user', text: messageText };
    setChatMessages(prev => [...prev, userMsg]);
    setInputValue('');
    
    // Context-aware AI response
    setTimeout(() => {
      let aiText = "I'm analyzing the SAP document flow for you. You can click on any node to see its full relationship chain.";
      
      const query = messageText.toLowerCase();
      
      // Find document by ID or Label in user query
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
        aiText = "Hello! I'm your Dodge AI Auditor. I can help you trace SAP Order-to-Cash flows. Try searching for a Sales Order or Delivery ID.";
      }
      
      setChatMessages(prev => [...prev, { type: 'ai', text: aiText }]);
    }, 800);
  };

  // Node Canvas Painting
  const paintNode = React.useCallback((node, ctx, globalScale) => {
    const isSelected = selectedNode?.id === node.id;
    const isHighlighted = highlightNodes.has(node.id) || (hoverNode === node);
    const color = NODE_COLORS[node.type] || NODE_COLORS.Default;
    
    // Pulsing effect for selected node
    let size = isHighlighted ? 8 : 5;
    if (isSelected) {
      const t = Date.now() / 400;
      size += Math.sin(t) * 2;
      
      ctx.beginPath();
      ctx.arc(node.x, node.y, size * 2, 0, 2 * Math.PI, false);
      ctx.fillStyle = `${color}22`;
      ctx.fill();
    }

    // Draw outer glow if highlighted
    if (isHighlighted || isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, size * 1.5, 0, 2 * Math.PI, false);
      ctx.fillStyle = `${color}44`;
      ctx.fill();
    }
    
    // Draw main circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Draw border
    ctx.lineWidth = 1/globalScale;
    ctx.strokeStyle = isSelected ? '#fff' : '#ffffff88';
    ctx.stroke();

    // Add Label at high zoom
    if (globalScale > 1.5 || isHighlighted || isSelected) {
      const label = node.id;
      const fontSize = 12/globalScale;
      ctx.font = isSelected ? `600 ${fontSize}px Inter` : `${fontSize}px Inter`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#fff';
      ctx.fillText(label, node.x, node.y + size + 2);
    }
  }, [highlightNodes, hoverNode, selectedNode]);

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
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
                    <span style={{ color: NODE_COLORS[node.type], fontWeight: 'bold', marginRight: '8px' }}>{node.type}</span>
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
                  <div style={{ background: NODE_COLORS[selectedNode.type], padding: '10px', borderRadius: '12px' }}>
                    {React.createElement(NODE_ICONS[selectedNode.type] || FileText, { size: 24, color: '#fff' })}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{selectedNode.type}</h2>
                    <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>{selectedNode.id}</p>
                  </div>
                </div>

                <div className="card">
                  <div className="card-title">Document Summary</div>
                  <div className="card-value">{selectedNode.label}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="card">
                    <div className="card-title">Creator</div>
                    <div style={{ fontSize: '1rem' }}>{selectedNode.createdByUser || 'N/A'}</div>
                  </div>
                  <div className="card">
                    <div className="card-title">Date</div>
                    <div style={{ fontSize: '1rem' }}>{selectedNode.creationDate ? new Date(selectedNode.creationDate).toLocaleDateString() : 'N/A'}</div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-title">Raw SAP Properties</div>
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

      {/* Main Graph Area */}
      <main className="graph-container">
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          backgroundColor="transparent"
          nodeId="id"
          nodeColor={n => NODE_COLORS[n.type] || NODE_COLORS.Default}
          nodeLabel={n => `${n.type}: ${n.id}\n${n.label}`}
          nodeCanvasObject={paintNode}
          linkWidth={link => highlightLinks.has(link) ? 3 : 1}
          linkDirectionalParticles={link => highlightLinks.has(link) ? 4 : 0}
          linkDirectionalParticleWidth={4}
          linkColor={link => highlightLinks.has(link) ? '#3b82f6' : '#2d2d35'}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          onNodeClick={handleNodeClick}
          onNodeHover={setHoverNode}
          d3AlphaDecay={0.05}
          d3VelocityDecay={0.2}
        />

        {/* Floating Chat Interface */}
        <div className="chat-overlay">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #2d2d35', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} color="#3b82f6" />
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Dodge AI Assistant</span>
            </div>
            <button 
              onClick={() => {
                // For now just clear messages or hide if we had a state
                setChatMessages([{ type: 'ai', text: 'Assistant reset. How can I help you?' }]);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
            >
              <X size={14} /> Close
            </button>
          </div>
          <div className="chat-messages">
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
