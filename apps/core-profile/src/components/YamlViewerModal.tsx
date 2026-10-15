import React, { useState } from 'react';
import { X, Copy, Check, Download, FileCode, CheckCircle2 } from 'lucide-react';

interface YamlViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawYaml: string;
}

export const YamlViewerModal: React.FC<YamlViewerModalProps> = ({ isOpen, onClose, rawYaml }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(rawYaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([rawYaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'profile.config.yml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(5, 11, 20, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0d131f',
          border: '1px solid var(--border-glow)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), var(--glow-cyan)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.2rem 1.5rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileCode size={20} color="var(--neon-cyan)" />
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Cấu Hình Nguồn: profile.config.yml</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Dữ liệu được nạp động từ thư mục <code style={{ color: 'var(--neon-cyan)' }}>public/profile.config.yml</code>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={handleCopy}
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              title="Sao chép nội dung"
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              <span>{copied ? 'Đã Chép' : 'Sao Chép'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              title="Tải file YAML về máy"
            >
              <Download size={14} />
              <span>Tải Về</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.4rem',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Đóng"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Code View Body */}
        <div
          style={{
            padding: '1.2rem 1.5rem',
            overflowY: 'auto',
            flex: 1,
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem',
            lineHeight: 1.6,
            background: '#070a12',
            color: '#e2e8f0',
          }}
        >
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {rawYaml}
          </pre>
        </div>

        {/* Modal Footer Note */}
        <div
          style={{
            padding: '0.8rem 1.5rem',
            borderTop: '1px solid var(--border-light)',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle2 size={15} color="#10b981" />
          <span>
            Bạn chỉ cần sửa file YAML này, trang web sẽ tự động render lại toàn bộ thông tin tương ứng.
          </span>
        </div>
      </div>
    </div>
  );
};
