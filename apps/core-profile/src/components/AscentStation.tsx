import React from 'react';
import { AscentStationInfo } from '../types/profile';

interface AscentStationProps {
  station: AscentStationInfo;
  year: number;
  isSummit?: boolean;
  /** Trạm chiếm trọn 1 màn hình và là một trang trong cơ chế chuyển trang (vd: Mặt Đất) */
  isFullPage?: boolean;
  /** Ẩn nhãn trạm (chấm trên trục + tên + mô tả) */
  hideHead?: boolean;
  /** Ẩn bảng đếm năm/tuổi (AltitudeHUD) khi đang xem trạm này */
  hideHud?: boolean;
  /** Nội dung trạm nghiêng/lùi theo chiều sâu 3D khi cuộn qua (tắt cho trạm có phần tử sticky/fixed) */
  depth3d?: boolean;
  children?: React.ReactNode;
}

// Một trạm trên trục Timeline vươn lên toàn trang (mỗi section là một trạm)
export const AscentStation: React.FC<AscentStationProps> = ({
  station,
  year,
  isSummit = false,
  isFullPage = false,
  hideHead = false,
  hideHud = false,
  depth3d = true,
  children,
}) => {
  return (
    <div
      className={`ascent-station${isSummit ? ' ascent-station--summit' : ''}${isFullPage ? ' ascent-station--page' : ''}`}
      data-snap-page={isFullPage || undefined}
      data-hide-hud={hideHud || undefined}
      data-ascent-label={`${station.icon} ${station.label}`}
      data-ascent-year={year}
    >
      {!hideHead && (
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
      )}
      {depth3d ? (
        <div className="station-depth" data-depth3d>
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
};
