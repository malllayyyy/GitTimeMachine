import React from 'react';

interface TimeScrubberProps {
    totalCommits: number;
    currentIndex: number;
    onChange: (index: number) => void;
}

const TimeScrubber: React.FC<TimeScrubberProps> = ({ totalCommits, currentIndex, onChange }) => {
    return (
        <div className="time-scrubber-container">
            <div className="scrubber-label-group">
                <span className="scrubber-title">Time Travel Scrubber</span>
                <span className="scrubber-counter">{currentIndex + 1} / {totalCommits}</span>
            </div>
            <input 
                type="range" 
                min={0} 
                max={Math.max(0, totalCommits - 1)} 
                value={currentIndex} 
                onChange={(e) => onChange(parseInt(e.target.value, 10))}
                className="timeline-slider"
            />
        </div>
    );
};

export default TimeScrubber;
