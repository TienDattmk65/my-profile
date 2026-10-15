import React from 'react';
import { AscentStationInfo } from '../types/profile';

interface AscentStationProps {
  station: AscentStationInfo;
  year: number;
  isSummit?: boolean;
  children: React.ReactNode;
}

// Một trạm trên trục Timeline vươn lên toàn trang (mỗi section là một trạm)
export const AscentStation: React.FC<AscentStationProps> = ({
  station,
  year,
  isSummit = false,
  children,
}) => {
  return (
    <div
      className={`ascent-station${isSummit ? ' ascent-station--summit' : ''}`}
      data-ascent-label={`${station.icon} ${station.label}`}
      data-ascent-year={year}
    >
      <div className="container">
        <div className="ascent-station-head">
          <span className="ascent-node" aria-hidden="true" />
          <span className="ascent-station-pill">
            <span>{station.icon}</span>
            <span>{station.label}</span>
          </span>
          {station.caption && <span className="ascent-station-caption">{station.caption}</span>}
        </div>
      </div>
      {children}
    </div>
  );
};
