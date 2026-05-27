import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export interface GraphNode {
    id: string;
    author: string;
    timestamp: number;
    message: string;
}

export interface GraphEdge {
    source: string;
    target: string;
}

interface SubwayGraphProps {
    nodes: GraphNode[];
    edges: GraphEdge[];
    activeCommitIndex: number;
    onCommitSelect: (id: string) => void;
}

const SubwayGraph: React.FC<SubwayGraphProps> = ({ nodes, edges, activeCommitIndex, onCommitSelect }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!svgRef.current || nodes.length === 0) return;

        const nodeSpacing = 120; // 120px between each node horizontally
        const margin = { top: 60, right: 60, bottom: 60, left: 60 };
        const height = 400;

        // Sort nodes by timestamp ascending
        const sortedNodes = [...nodes].sort((a, b) => a.timestamp - b.timestamp);
        
        // Calculate dynamic width based on the number of commits
        const width = Math.max(800, sortedNodes.length * nodeSpacing + margin.left + margin.right);

        // Advanced Subway Track Assignment Algorithm
        const tracks = new Map<string, number>(); // node ID -> track index
        const activeTracks = new Set<number>();
        activeTracks.add(0); // Main track always active

        sortedNodes.forEach((node, index) => {
            if (index === 0) {
                tracks.set(node.id, 0);
                return;
            }

            const incomingEdges = edges.filter(e => e.target === node.id);

            if (incomingEdges.length === 0) {
                tracks.set(node.id, 0);
            } else if (incomingEdges.length === 1) {
                // Continuation
                const parentId = incomingEdges[0].source;
                const parentTrack = tracks.get(parentId) ?? 0;
                tracks.set(node.id, parentTrack);
            } else {
                // Merge commit
                const parentId = incomingEdges[0].source;
                const parentTrack = tracks.get(parentId) ?? 0;
                tracks.set(node.id, parentTrack);
            }

            // Fork detection
            const outgoingEdges = edges.filter(e => e.source === node.id);
            if (outgoingEdges.length > 1) {
                outgoingEdges.forEach((edge, idx) => {
                    if (idx > 0) {
                        let freeTrack = 1;
                        while (activeTracks.has(freeTrack) || activeTracks.has(-freeTrack)) {
                            freeTrack++;
                        }
                        const trackSign = idx % 2 === 0 ? -1 : 1;
                        const finalTrack = freeTrack * trackSign;
                        tracks.set(edge.target, finalTrack);
                        activeTracks.add(finalTrack);
                    }
                });
            }
        });

        // Compute actual coordinates
        const layoutNodes = sortedNodes.map((n, i) => {
            const track = tracks.get(n.id) ?? 0;
            return {
                ...n,
                x: margin.left + (i * nodeSpacing),
                y: height / 2 + (track * 60)
            };
        });

        const idToNode = new Map(layoutNodes.map(n => [n.id, n]));

        const layoutEdges = edges.map(e => ({
            source: idToNode.get(e.source),
            target: idToNode.get(e.target)
        })).filter(e => e.source && e.target);

        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height);

        svg.selectAll('*').remove(); // Clear previous render

        // Add Defs for Gradients and Filters
        const defs = svg.append('defs');

        // Blueprint Grid Pattern
        defs.append('pattern')
            .attr('id', 'blueprint-grid')
            .attr('width', 40)
            .attr('height', 40)
            .attr('patternUnits', 'userSpaceOnUse')
            .append('path')
            .attr('d', 'M 40 0 L 0 0 0 40')
            .attr('fill', 'none')
            .attr('stroke', 'rgba(255, 255, 255, 0.02)')
            .attr('stroke-width', 1);

        // Glowing filter for active node
        const glowFilter = defs.append('filter')
            .attr('id', 'active-glow')
            .attr('x', '-50%')
            .attr('y', '-50%')
            .attr('width', '200%')
            .attr('height', '200%');
        glowFilter.append('feGaussianBlur')
            .attr('stdDeviation', 6)
            .attr('result', 'blur');
        const feMerge = glowFilter.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'blur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        // Active commit timeline details
        const activeNodeId = sortedNodes[activeCommitIndex]?.id;
        const activeTimestamp = sortedNodes[activeCommitIndex]?.timestamp || 0;

        // Background grid rect
        svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'url(#blueprint-grid)');

        const g = svg.append('g');

        // Draw connections with curved edges (subway style)
        const linkGenerator = d3.linkHorizontal<any, any>()
            .x(d => d.x)
            .y(d => d.y);

        g.selectAll('.edge')
            .data(layoutEdges)
            .enter()
            .append('path')
            .attr('class', 'edge')
            .attr('d', d => linkGenerator({ source: d.source, target: d.target }))
            .attr('fill', 'none')
            .attr('stroke', d => {
                // If either node is in the "future" relative to active scrubber, dim the connection
                const sourceFuture = d.source!.timestamp > activeTimestamp;
                const targetFuture = d.target!.timestamp > activeTimestamp;
                return sourceFuture || targetFuture ? '#222222' : 'url(#active-line-gradient)';
            })
            .attr('stroke-width', d => {
                const sourceFuture = d.source!.timestamp > activeTimestamp;
                const targetFuture = d.target!.timestamp > activeTimestamp;
                return sourceFuture || targetFuture ? 2.5 : 4;
            })
            .style('transition', 'stroke 0.3s ease, stroke-width 0.3s ease');

        // Define connection gradient inside defs dynamically
        const edgeGradient = defs.append('linearGradient')
            .attr('id', 'active-line-gradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '100%')
            .attr('y2', '0%');
        edgeGradient.append('stop').attr('offset', '0%').attr('stop-color', '#00b8ff');
        edgeGradient.append('stop').attr('offset', '100%').attr('stop-color', '#00ffd0');

        // Draw node groups
        const nodeGroups = g.selectAll('.node-group')
            .data(layoutNodes)
            .enter()
            .append('g')
            .attr('class', 'node-group')
            .attr('transform', d => `translate(${d.x}, ${d.y})`)
            .style('cursor', 'pointer')
            .on('click', (_event, d) => onCommitSelect(d.id));

        // Outer glow rings for active node
        nodeGroups.filter(d => d.id === activeNodeId)
            .append('circle')
            .attr('r', 16)
            .attr('fill', 'none')
            .attr('stroke', '#00ffd0')
            .attr('stroke-width', 2)
            .attr('filter', 'url(#active-glow)')
            .style('opacity', 0.8);

        // Core node circle
        nodeGroups.append('circle')
            .attr('r', d => d.id === activeNodeId ? 10 : 8)
            .attr('fill', d => {
                if (d.id === activeNodeId) return '#00ffd0';
                if (d.timestamp > activeTimestamp) return '#151515';
                return '#00b8ff';
            })
            .attr('stroke', d => {
                if (d.id === activeNodeId) return '#ffffff';
                if (d.timestamp > activeTimestamp) return '#252525';
                return '#1a1a1a';
            })
            .attr('stroke-width', 2.5)
            .style('transition', 'fill 0.3s, stroke 0.3s, r 0.3s')
            .on('mouseover', function (_event, d) {
                d3.select(this)
                    .attr('r', d.id === activeNodeId ? 13 : 11)
                    .attr('stroke', '#ffffff');
            })
            .on('mouseout', function (_event, d) {
                d3.select(this)
                    .attr('r', d.id === activeNodeId ? 10 : 8)
                    .attr('stroke', d.id === activeNodeId ? '#ffffff' : (d.timestamp > activeTimestamp ? '#252525' : '#1a1a1a'));
            });

        // Commit label (SHA-1 abbreviation)
        nodeGroups.append('text')
            .attr('y', d => (tracks.get(d.id) ?? 0) >= 0 ? -20 : 25)
            .attr('text-anchor', 'middle')
            .attr('fill', d => {
                if (d.id === activeNodeId) return '#00ffd0';
                if (d.timestamp > activeTimestamp) return '#3d3d3d';
                return '#a0a0a0';
            })
            .style('font-size', '11px')
            .style('font-weight', d => d.id === activeNodeId ? 'bold' : 'normal')
            .style('font-family', 'monospace')
            .text(d => d.id.substring(0, 7));

        // Commit message tooltip indicator
        nodeGroups.append('text')
            .attr('y', d => (tracks.get(d.id) ?? 0) >= 0 ? -34 : 39)
            .attr('text-anchor', 'middle')
            .attr('fill', '#555555')
            .style('font-size', '10px')
            .style('font-family', 'Inter, sans-serif')
            .style('pointer-events', 'none')
            .text(d => d.message.length > 15 ? d.message.substring(0, 15) + '...' : d.message);

        // Auto-scroll layout container to keep active commit visible
        if (containerRef.current) {
            const activeNode = layoutNodes.find(n => n.id === activeNodeId);
            if (activeNode) {
                const containerWidth = containerRef.current.clientWidth;
                const scrollTarget = activeNode.x - containerWidth / 2;
                containerRef.current.scrollTo({
                    left: Math.max(0, scrollTarget),
                    behavior: 'smooth'
                });
            }
        }

    }, [nodes, edges, activeCommitIndex, onCommitSelect]);

    return (
        <div 
            ref={containerRef}
            className="graph-scroll-container"
            style={{ 
                width: '100%', 
                overflowX: 'auto', 
                backgroundColor: '#0a0a0a', 
                borderRadius: '12px', 
                border: '1px solid #1a1a1a',
                boxShadow: 'inset 0 4px 20px rgba(0, 0, 0, 0.5)'
            }}
        >
            <svg ref={svgRef} style={{ display: 'block' }} />
        </div>
    );
};

export default SubwayGraph;
