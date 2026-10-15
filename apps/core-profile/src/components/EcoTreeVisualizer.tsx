import React from 'react';
import { ShowcaseProject } from '../types/profile';
import { InteractiveFruitButton } from './InteractiveFruitButton';

interface EcoTreeVisualizerProps {
  currentStage: 'seed' | 'sprout' | 'sapling' | 'blooming' | 'mature';
  projects: ShowcaseProject[];
  onSelectProject?: (project: ShowcaseProject) => void;
}

export const EcoTreeVisualizer: React.FC<EcoTreeVisualizerProps> = ({
  currentStage,
  projects,
  onSelectProject,
}) => {
  // Tọa độ các Quả Đào Microservices trên cành cây đào
  const fruitPositions: Record<string, { x: number; y: number }> = {
    'devops-k8s': { x: 26, y: 35 },
    'ai-assistant': { x: 50, y: 22 },
    'data-analytics': { x: 74, y: 36 },
  };

  // Helper render đóa hoa đào cắt giấy 5 cánh
  const renderPeachBlossom = (cx: number, cy: number, scale = 1, rotation = 0) => (
    <g
      key={`${cx}-${cy}`}
      transform={`translate(${cx}, ${cy}) rotate(${rotation}) scale(${scale})`}
      filter="url(#paperShadow)"
      className="peach-blossom-group"
    >
      {/* 5 cánh hoa đào hồng phấn xếp tầng */}
      {[0, 72, 144, 216, 288].map((angle, idx) => (
        <path
          key={idx}
          d="M0 0 C -6 -14, 6 -14, 0 0"
          transform={`rotate(${angle})`}
          fill="#ffb3c1"
          stroke="#ff8fa3"
          strokeWidth="0.8"
        />
      ))}
      {/* Cánh hoa phụ tạo chiều sâu giấy */}
      {[36, 108, 180, 252, 324].map((angle, idx) => (
        <circle
          key={`dot-${idx}`}
          cx="0"
          cy="-7"
          r="4.5"
          transform={`rotate(${angle})`}
          fill="#ff8fa3"
          opacity="0.9"
        />
      ))}
      {/* Nhụy hoa đỏ tươi thắm */}
      <circle cx="0" cy="0" r="3.2" fill="#c9184a" />
      <circle cx="0" cy="0" r="1.6" fill="#ffe6a7" />
    </g>
  );

  // Helper render nụ hoa đào
  const renderPeachBud = (cx: number, cy: number, rotation = 0) => (
    <g
      key={`bud-${cx}-${cy}`}
      transform={`translate(${cx}, ${cy}) rotate(${rotation})`}
      filter="url(#paperShadow)"
    >
      <path d="M0 0 C -3 -8, 3 -8, 0 0" fill="#ff758f" />
      <path d="M-2 1 C -4 5, 0 6, 0 0" fill="#52b788" />
    </g>
  );

  // Helper render lá đào xanh cắt gập nếp
  const renderPeachLeaf = (cx: number, cy: number, scale = 1, rotation = 0) => (
    <g
      key={`leaf-${cx}-${cy}`}
      transform={`translate(${cx}, ${cy}) rotate(${rotation}) scale(${scale})`}
      filter="url(#paperShadow)"
    >
      {/* Nửa lá đậm */}
      <path d="M0 -15 C -8 -5, -8 5, 0 15 Z" fill="#2d6a4f" />
      {/* Nửa lá sáng (gấp nếp giấy) */}
      <path d="M0 -15 C 8 -5, 8 5, 0 15 Z" fill="#52b788" />
      {/* Gân giữa lá */}
      <line x1="0" y1="-15" x2="0" y2="15" stroke="#1b4332" strokeWidth="0.75" />
    </g>
  );

  return (
    <div className="tree-sticky-card tree-sticky-card--bare">
      {/* SVG Canvas Cây Đào & Hạt Đào Nghệ Thuật Cắt Giấy */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1.15',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          viewBox="0 0 420 460"
          style={{
            width: '100%',
            height: '100%',
            overflow: 'visible',
          }}
        >
          <defs>
            {/* Hiệu ứng bóng đổ giấy 3D cắt nổi (Layered Paper Shadows) */}
            <filter id="paperShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000" floodOpacity="0.45" />
            </filter>

            <filter id="deepPaperShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="3" dy="6" stdDeviation="5" floodColor="#000" floodOpacity="0.55" />
            </filter>

            {/* Màu vân gỗ thân cây đào (Wood Kraft Paper) */}
            <linearGradient id="peachWoodGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7a4b3a" />
              <stop offset="50%" stopColor="#5d3829" />
              <stop offset="100%" stopColor="#43261a" />
            </linearGradient>

            {/* Hạt đào màu nâu gỗ có rãnh vân */}
            <linearGradient id="peachSeedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8d5b4c" />
              <stop offset="60%" stopColor="#673d31" />
              <stop offset="100%" stopColor="#4a2c22" />
            </linearGradient>
          </defs>

          {/* ====================================================================
              GIAI ĐOẠN 1: HẠT ĐÀO CẮT GIẤY (2002 - KHỞI NGUYÊN)
              Chỉ có hạt đào trơn, không có thịt quả bao quanh
              ==================================================================== */}
          {currentStage === 'seed' && (
            <g style={{ transition: 'all 0.5s ease' }}>
              {/* Bóng hạt đào in xuống nền giấy */}
              <ellipse cx="210" cy="385" rx="70" ry="12" fill="#000" opacity="0.25" />

              {/* HẠT ĐÀO (THE ICONIC PEACH SEED WITH GROOVES) */}
              <g transform="translate(210, 245) scale(2.2) translate(-145, -272)" filter="url(#deepPaperShadow)">
                {/* Thân hạt đào oval có đầu nhọn */}
                <path
                  d="M145 215 C 175 240 178 300 145 330 C 112 300 115 240 145 215 Z"
                  fill="url(#peachSeedGrad)"
                  stroke="#3d2319"
                  strokeWidth="1"
                />
                {/* Các nếp rãnh gân đặc trưng của hạt đào cắt giấy */}
                <path d="M145 225 Q 138 270 145 320" stroke="#351d14" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                <path d="M136 240 Q 128 275 135 310" stroke="#351d14" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <path d="M154 240 Q 162 275 155 310" stroke="#351d14" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <path d="M128 255 Q 124 275 129 295" stroke="#351d14" strokeWidth="1" fill="none" strokeLinecap="round" />
                <path d="M162 255 Q 166 275 161 295" stroke="#351d14" strokeWidth="1" fill="none" strokeLinecap="round" />
                <path d="M140 260 Q 143 275 140 290" stroke="#25120c" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                <path d="M150 260 Q 147 275 150 290" stroke="#25120c" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              </g>

            </g>
          )}

          {/* ====================================================================
              GIAI ĐOẠN 2: MẦM CÂY ĐÀO ĐÂM CHỒI (2018)
              ==================================================================== */}
          {currentStage === 'sprout' && (
            <g style={{ transition: 'all 0.5s ease' }}>
              {/* Thảm cỏ xanh cắt giấy */}
              <path
                d="M130 420 L150 395 L165 420 L185 390 L200 420 L215 390 L235 420 L255 395 L275 420 Z"
                fill="#40916c"
                filter="url(#paperShadow)"
              />

              {/* Hạt đào dưới đất nảy mầm */}
              <ellipse cx="200" cy="405" rx="20" ry="14" fill="url(#peachSeedGrad)" filter="url(#paperShadow)" />

              {/* Thân mầm đào gỗ nâu */}
              <path
                d="M200 405 C 190 340 215 280 200 230"
                stroke="url(#peachWoodGrad)"
                strokeWidth="10"
                strokeLinecap="round"
                fill="none"
                filter="url(#paperShadow)"
              />

              {/* Hai lá đào xanh cắt giấy vươn lên */}
              {renderPeachLeaf(160, 260, 1.8, -50)}
              {renderPeachLeaf(240, 245, 1.8, 55)}

              {/* Nụ hoa đào đầu tiên */}
              {renderPeachBud(200, 220, 0)}

            </g>
          )}

          {/* ====================================================================
              GIAI ĐOẠN 3: CÂY ĐÀO TRẺ VỮNG CHÃI (2020 - 2024)
              ==================================================================== */}
          {currentStage === 'sapling' && (
            <g style={{ transition: 'all 0.5s ease' }}>
              {/* Thảm cỏ xanh cắt giấy ở gốc */}
              <path
                d="M110 420 L135 390 L160 420 L185 385 L210 420 L235 385 L260 420 L285 390 L310 420 Z"
                fill="#40916c"
                filter="url(#paperShadow)"
              />

              {/* Thân cây đào nâu kraft phân nhánh */}
              <g filter="url(#deepPaperShadow)">
                <path d="M185 415 C 190 320 180 260 170 210" stroke="url(#peachWoodGrad)" strokeWidth="18" strokeLinecap="round" fill="none" />
                <path d="M215 415 C 210 320 220 260 230 210" stroke="url(#peachWoodGrad)" strokeWidth="18" strokeLinecap="round" fill="none" />

                {/* Nhánh trái */}
                <path d="M175 280 C 130 240 100 210 70 190" stroke="url(#peachWoodGrad)" strokeWidth="9" strokeLinecap="round" fill="none" />
                {/* Nhánh phải */}
                <path d="M225 270 C 270 230 300 200 330 180" stroke="url(#peachWoodGrad)" strokeWidth="9" strokeLinecap="round" fill="none" />
                {/* Nhánh giữa */}
                <path d="M200 220 C 200 170 200 150 200 130" stroke="url(#peachWoodGrad)" strokeWidth="9" strokeLinecap="round" fill="none" />
              </g>

              {/* Tán lá đào xanh tươi cắt giấy */}
              {renderPeachLeaf(70, 185, 1.5, -45)}
              {renderPeachLeaf(115, 230, 1.4, -30)}
              {renderPeachLeaf(200, 125, 1.7, 0)}
              {renderPeachLeaf(285, 220, 1.4, 30)}
              {renderPeachLeaf(330, 175, 1.5, 45)}

              {/* Những nụ đào hồng chúm chím */}
              {renderPeachBud(90, 180, -25)}
              {renderPeachBud(200, 110, 0)}
              {renderPeachBud(310, 170, 25)}

            </g>
          )}

          {/* ====================================================================
              GIAI ĐOẠN 4: CÂY ĐÀO NỞ RỘ HOA ĐÀO (2023 - 2024)
              Tái hiện sắc nét cành hoa đào cắt giấy từ hình mẫu
              ==================================================================== */}
          {currentStage === 'blooming' && (
            <g style={{ transition: 'all 0.5s ease' }}>
              {/* Thảm cỏ xanh cắt giấy ở gốc */}
              <path
                d="M90 425 L120 390 L150 425 L180 380 L210 425 L240 380 L270 425 L300 390 L330 425 Z"
                fill="#40916c"
                filter="url(#paperShadow)"
              />

              {/* Thân cây đào cổ thụ kraft */}
              <g filter="url(#deepPaperShadow)">
                <path d="M175 420 C 185 300 170 230 160 180" stroke="url(#peachWoodGrad)" strokeWidth="26" strokeLinecap="round" fill="none" />
                <path d="M225 420 C 215 300 230 230 240 180" stroke="url(#peachWoodGrad)" strokeWidth="26" strokeLinecap="round" fill="none" />

                {/* Nhánh vươn sang các bên */}
                <path d="M170 250 C 110 210 80 180 50 150" stroke="url(#peachWoodGrad)" strokeWidth="12" strokeLinecap="round" fill="none" />
                <path d="M165 210 C 120 150 95 120 70 85" stroke="url(#peachWoodGrad)" strokeWidth="10" strokeLinecap="round" fill="none" />
                <path d="M200 200 C 200 140 200 110 200 70" stroke="url(#peachWoodGrad)" strokeWidth="12" strokeLinecap="round" fill="none" />
                <path d="M235 210 C 280 150 305 120 330 85" stroke="url(#peachWoodGrad)" strokeWidth="10" strokeLinecap="round" fill="none" />
                <path d="M230 250 C 290 210 320 180 350 150" stroke="url(#peachWoodGrad)" strokeWidth="12" strokeLinecap="round" fill="none" />
              </g>

              {/* LÁ ĐÀO XANH XEN KẼ */}
              {renderPeachLeaf(40, 145, 1.2, -40)}
              {renderPeachLeaf(70, 75, 1.2, -25)}
              {renderPeachLeaf(140, 100, 1.2, -15)}
              {renderPeachLeaf(260, 100, 1.2, 15)}
              {renderPeachLeaf(330, 75, 1.2, 25)}
              {renderPeachLeaf(360, 145, 1.2, 40)}

              {/* HOA ĐÀO HỒNG PHẤN 5 CÁNH XẾP TẦNG (PEACH BLOSSOMS) */}
              {renderPeachBlossom(50, 150, 1.3, 10)}
              {renderPeachBlossom(90, 115, 1.4, -20)}
              {renderPeachBlossom(120, 160, 1.2, 35)}
              {renderPeachBlossom(155, 95, 1.5, 15)}
              {renderPeachBlossom(200, 65, 1.6, 0)}
              {renderPeachBlossom(245, 95, 1.5, -15)}
              {renderPeachBlossom(280, 160, 1.2, -35)}
              {renderPeachBlossom(310, 115, 1.4, 20)}
              {renderPeachBlossom(350, 150, 1.3, -10)}

              {/* NỤ ĐÀO CHÚM CHÍM */}
              {renderPeachBud(65, 180, -30)}
              {renderPeachBud(105, 75, -20)}
              {renderPeachBud(180, 45, -10)}
              {renderPeachBud(220, 45, 10)}
              {renderPeachBud(295, 75, 20)}
              {renderPeachBud(335, 180, 30)}
            </g>
          )}

          {/* ====================================================================
              GIAI ĐOẠN 5: CÂY ĐÀO ĐẠI THỤ TRĨU QUẢ ĐÀO MICROSERVICES (HIỆN TẠI)
              ==================================================================== */}
          {currentStage === 'mature' && (
            <g style={{ transition: 'all 0.5s ease' }}>
              {/* Thảm cỏ xanh cắt giấy ở gốc */}
              <path
                d="M80 430 L115 390 L150 430 L185 380 L220 430 L255 380 L290 430 L325 390 L360 430 Z"
                fill="#40916c"
                filter="url(#paperShadow)"
              />

              {/* Thân cây đào đại thụ kraft uy nghiêm */}
              <g filter="url(#deepPaperShadow)">
                <path d="M170 425 C 185 300 170 220 160 170" stroke="url(#peachWoodGrad)" strokeWidth="30" strokeLinecap="round" fill="none" />
                <path d="M230 425 C 215 300 230 220 240 170" stroke="url(#peachWoodGrad)" strokeWidth="30" strokeLinecap="round" fill="none" />

                {/* Nhánh vươn tới Quả Đào 1 (DevOps K8s - x=26%, y=35%) */}
                <path d="M165 240 C 130 195 109 160 109 160" stroke="url(#peachWoodGrad)" strokeWidth="13" strokeLinecap="round" fill="none" />
                {/* Nhánh vươn tới Quả Đào 2 (AI Assistant - x=50%, y=22%) */}
                <path d="M200 200 C 200 150 210 101 210 101" stroke="url(#peachWoodGrad)" strokeWidth="14" strokeLinecap="round" fill="none" />
                {/* Nhánh vươn tới Quả Đào 3 (Data Analytics - x=74%, y=36%) */}
                <path d="M235 240 C 270 195 310 165 310 165" stroke="url(#peachWoodGrad)" strokeWidth="13" strokeLinecap="round" fill="none" />
              </g>

              {/* HOA ĐÀO HỒNG PHẤN NỞ RỘ TRÊN CÁC CÀNH */}
              {renderPeachBlossom(70, 110, 1.3, -15)}
              {renderPeachBlossom(145, 80, 1.4, 20)}
              {renderPeachBlossom(200, 50, 1.5, 0)}
              {renderPeachBlossom(255, 80, 1.4, -20)}
              {renderPeachBlossom(330, 110, 1.3, 15)}
              {renderPeachBlossom(180, 140, 1.2, 45)}
              {renderPeachBlossom(220, 140, 1.2, -45)}

              {/* LÁ ĐÀO XANH GẤP NẾP */}
              {renderPeachLeaf(50, 140, 1.3, -45)}
              {renderPeachLeaf(110, 60, 1.3, -20)}
              {renderPeachLeaf(290, 60, 1.3, 20)}
              {renderPeachLeaf(350, 140, 1.3, 45)}
            </g>
          )}
        </svg>

        {/* CÁC NÚT BẤM QUẢ ĐÀO MICROSERVICES (CHỈ HIỆN Ở MỐC MATURE - HIỆN TẠI) */}
        {currentStage === 'mature' &&
          projects.map((proj) => {
            const pos = fruitPositions[proj.id] || proj.fruitPosition || { x: 50, y: 50 };
            return (
              <InteractiveFruitButton
                key={proj.id}
                project={proj}
                position={pos}
                onSelect={onSelectProject}
              />
            );
          })}
      </div>

    </div>
  );
};
