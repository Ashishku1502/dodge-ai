import { useState, useEffect } from 'react';

export const useGraphData = () => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/data/graph_data.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!data || !data.nodes || !data.links) throw new Error("Invalid graph data format");
        const enhancedLinks = data.links.map(link => ({
          ...link,
          source: link.source,
          target: link.target
        }));
        setGraphData({ nodes: data.nodes, links: enhancedLinks });
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Error loading graph data:", err);
        setError("Unable to load graph data. Please verify your data source.");
        setIsLoading(false);
      });
  }, []);

  return { graphData, isLoading, error };
};
