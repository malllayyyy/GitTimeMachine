import React from 'react';
import type { GraphNode } from './SubwayGraph';

interface CommitSidebarProps {
    commit: GraphNode | null;
}

const CommitSidebar: React.FC<CommitSidebarProps> = ({ commit }) => {
    if (!commit) {
        return (
            <div className="commit-sidebar empty">
                <h3>Commit Details</h3>
                <p className="empty-text">Select any commit node along the tracks to inspect its full structural metadata.</p>
            </div>
        );
    }

    const date = new Date(commit.timestamp * 1000).toLocaleString();

    return (
        <div className="commit-sidebar">
            <h3>Commit Details</h3>
            
            <div className="detail-card">
                <div className="field">
                    <span className="field-label">SHA-1 Hash</span>
                    <span className="field-value hash">{commit.id}</span>
                </div>
                
                <div className="field">
                    <span className="field-label">Author</span>
                    <span className="field-value">{commit.author}</span>
                </div>
                
                <div className="field">
                    <span className="field-label">Committed Date</span>
                    <span className="field-value">{date}</span>
                </div>
            </div>
            
            <div className="message-section">
                <span className="field-label">Commit Message</span>
                <p className="message-content">{commit.message}</p>
            </div>
        </div>
    );
};

export default CommitSidebar;
