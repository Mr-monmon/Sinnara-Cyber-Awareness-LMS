const LoadingScreen = () => (
  <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@700;900&display=swap');

      @keyframes aw-breathe {
        0%, 100% { transform: scale(1);    opacity: 1;    }
        50%       { transform: scale(1.07); opacity: 0.80; }
      }
      @keyframes aw-glow {
        0%, 100% { filter: drop-shadow(0 0 14px rgba(200,255,0,0.30)) drop-shadow(0 0 36px rgba(200,255,0,0.08)); }
        50%       { filter: drop-shadow(0 0 28px rgba(200,255,0,0.65)) drop-shadow(0 0 64px rgba(200,255,0,0.22)); }
      }
      @keyframes aw-ring-cw  { to { transform: rotate(360deg);  } }
      @keyframes aw-ring-ccw { to { transform: rotate(-360deg); } }
      @keyframes aw-shimmer {
        0%   { background-position: -300% center; }
        100% { background-position:  300% center; }
      }
      @keyframes aw-dot {
        0%, 80%, 100% { opacity: 0.18; transform: scale(0.65); }
        40%           { opacity: 1;   transform: scale(1);    }
      }
      @keyframes aw-fade-up {
        from { opacity: 0; transform: translateY(18px); }
        to   { opacity: 1; transform: translateY(0);   }
      }
      @keyframes aw-bg-pulse {
        0%, 100% { opacity: 0.4; transform: scale(1);    }
        50%       { opacity: 0.7; transform: scale(1.12); }
      }

      .aw-ls-logo {
        animation: aw-breathe 2.8s ease-in-out infinite, aw-glow 2.8s ease-in-out infinite;
        transform-origin: center; will-change: transform, filter;
      }
      .aw-ls-ring1 { animation: aw-ring-cw  2.6s linear infinite; transform-origin: center; }
      .aw-ls-ring2 { animation: aw-ring-ccw 1.8s linear infinite; transform-origin: center; }

      .aw-ls-wordmark {
        font-family: 'Inter', sans-serif; font-size: 28px; font-weight: 900;
        letter-spacing: -0.5px;
        background: linear-gradient(90deg, #c8ff00 0%, #ffffff 30%, #d9f23f 50%, #ffffff 70%, #c8ff00 100%);
        background-size: 300% auto;
        -webkit-background-clip: text; background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: aw-shimmer 3s linear infinite;
        margin-top: 26px;
      }
      .aw-ls-dot {
        width: 7px; height: 7px; border-radius: 50%; background: #c8ff00;
        animation: aw-dot 1.5s ease-in-out infinite;
      }
      .aw-ls-dot:nth-child(1) { animation-delay: 0s;   }
      .aw-ls-dot:nth-child(2) { animation-delay: 0.22s; }
      .aw-ls-dot:nth-child(3) { animation-delay: 0.44s; }
      .aw-ls-wrap { animation: aw-fade-up 0.7s ease both; }
      .aw-ls-bg   { animation: aw-bg-pulse 3s ease-in-out infinite; }
    `}</style>

    <div style={{ minHeight: '100vh', background: '#12140a', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>

      {/* Ambient background glow */}
      <div className="aw-ls-bg" style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,255,0,0.055) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div className="aw-ls-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Logo + rings container */}
        <div style={{ position: 'relative', width: 188, height: 188, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

          {/* Outer dashed ring */}
          <svg className="aw-ls-ring1" style={{ position: 'absolute', inset: 0 }} width="188" height="188" viewBox="0 0 188 188">
            <circle cx="94" cy="94" r="86" fill="none" stroke="rgba(200,255,0,0.18)" strokeWidth="1.5" strokeDasharray="5 8" strokeLinecap="round" />
          </svg>

          {/* Inner arc ring */}
          <svg className="aw-ls-ring2" style={{ position: 'absolute', inset: 0 }} width="188" height="188" viewBox="0 0 188 188">
            <path d="M 94 22 A 72 72 0 0 1 160 75"  fill="none" stroke="rgba(200,255,0,0.60)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 94 166 A 72 72 0 0 1 28 113"  fill="none" stroke="rgba(200,255,0,0.28)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>

          {/* Logo */}
          <div className="aw-ls-logo" style={{ width: 112, height: 112, flexShrink: 0 }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="250 290 760 730" width="112" height="112">
              {/* Left shape */}
              <path
                d="M0 0 C20 0 22 1 27.56 1.08 C35.10 1.03 39.25 1.01 48.20 0.95 C62.37 0.88 80.68 0.81 102.68 0.67 C124.93 0.57 136.70 0.50 147.79 0.45 C163.09 0.43 170.02 2.19 176.87 8.75 C180.36 14.79 181.78 18.20 186.75 28.56 C191 37 192.41 39.81 195.25 45.43 C198.07 51.08 201.43 58.43 204 63 C208.47 71.66 209.78 74.88 211.18 78.25 C217.03 91.24 220.33 97.59 225 109 C227.30 112.59 229.32 119.71 233.06 123.5 C239 136 240.12 138.31 242.37 142.94 C257.28 173.65 263.14 186.17 265.61 191.33 C270 206 270 206 272 205 C277.93 217.25 285 234 295 254 C297 256 302 272 304 272 C309.49 283.20 314.05 292.50 318 305 C321.37 307.72 324.06 313.18 327.74 325.05 C330 326 331.31 328.76 335.06 336.69 C338 343 339 346 344.11 355.93 C348 368 350.31 370.25 354 377 C358.63 384.90 358 390 360 389 C363.37 396.62 368.03 408.27 372 415 C377.24 428.08 378.60 435.07 381 443 C385.55 459.19 383.48 478 376.18 492.93 C372.35 500.11 366 504 362.96 511.27 C353.25 517.37 348.75 518.43 346 522 C326.25 529.48 293.34 535.53 278 536 C265.75 522 251.54 500.07 243 490 C238.70 486.62 233.5 481.87 213.94 466.17 C192.13 459.25 167.11 461.33 119 475 C88.01 487.22 74.18 493.18 -63 536 C-105.29 540.39 -144.95 535.31 -177.93 511.56 C-203.02 494.71 -215.78 461.84 -221.63 440.70 C-229.81 410.08 -231.56 379.30 -226 348 C-218.58 305.54 -200.60 268.05 -184.12 231.51 C-178 218 -170.80 202.81 -167.29 195.39 C-161.87 183.91 -157.83 174.86 -153 171 C-148 154.12 -146.49 151.05 -142 142 C-134.21 126.21 -133 125 -131.43 120.93 C-125.57 106.10 -117.42 92.08 -110 78 C-107 77 -109 76 -86.29 32 C-78 17 -75.75 14.37 -71 5 C-67 4 -67 2 -58.80 0.88 C-34.73 0.93 0 1 0 0 Z"
                fill="#D9F23F"
                transform="translate(319,357)"
              />
              {/* Right shape */}
              <path
                d="M0 0 C7.67 0.004 10.30 0.015 15.57 -0.007 C20.62 0 22.99 -0.012 27.52 0.026 C35.31 2.26 41.04 3.08 47.5 3.82 C53.98 4.58 56.86 4.90 62.31 6.26 C69.81 7.76 80.31 10.26 90.96 13.23 C98.31 16.26 103.80 17.55 119.31 23.26 C129.31 28.26 139.31 34.26 156.06 42.70 C164.31 50.26 164.31 50.26 177 57.20 C187.33 66.28 191.31 70.26 207.31 85.26 C217.31 96.26 221.81 100.70 227.31 109.26 C231.31 113.26 237.31 121.26 243.31 131.26 C251.62 145.26 257.31 157.26 260.31 160.26 C267.31 179.26 272.87 192.45 277.31 211.26 C284.93 272.76 284.47 286.14 284.31 290.26 C278.43 341.51 272.95 361.35 271.31 367.26 C268.31 374.13 266.09 380.12 264.31 385.26 C261.31 387.26 260.31 394.26 259.31 395.26 C254.31 402.26 252.31 410.26 250.31 411.26 C244.46 423.68 235.06 437.45 229.31 445.26 C222.88 453.22 220.5 455.76 211.31 465.26 C200.31 476.26 196.31 481.26 184.31 491.26 C176.99 497.65 170.81 501.95 160.31 508.26 C152 514.14 134.93 522.95 116.75 531.26 C109.31 534.26 90.31 540.26 78.34 543.88 C67.37 547.39 57.31 548.26 57.31 549.26 C43.31 550.26 43.31 551.26 21.78 552.39 C-21.53 552.34 -25.68 550.26 -69.03 541.29 C-89.68 534.26 -92.68 525.26 -95.68 527.26 C-90.50 513.93 -87.68 503.26 -85.16 491.47 C-82.39 478.75 -85.44 463.95 -99.68 418.01 C-106.25 405.76 -117.68 376.26 -119.68 378.26 C-125.29 365.37 -128.52 358.41 -132.68 349.26 C-134.68 345.26 -134.68 345.26 -140.10 333.98 C-147.89 317.92 -151.18 309.57 -153.68 306.26 C-159.11 294.97 -163.73 284.34 -167.68 276.26 C-169.68 273.26 -171 271.01 -170.68 263.26 C-175.19 261.14 -182.68 245.26 -188.68 231.26 C-196.68 212.26 -209.68 187.26 -213.68 180.26 C-218.06 171.01 -228.68 149.20 -225.62 142.26 C-221.68 127.26 -219.68 126.26 -217.68 121.26 C-211.90 113.37 -209.68 112.26 -206.68 106.26 C-202.43 101.20 -197.68 96.26 -191.68 91.26 C-186.68 86.26 -185.68 84.26 -181.68 81.26 C-175.64 74.67 -168.68 68.26 -156.68 58.26 C-140.39 45.92 -108.68 27.82 -87.68 21.26 C-84.85 17.94 -77.18 15.32 -56.68 10.26 C-34.34 4.54 -22.83 3.30 -11.90 1.23 C-7.84 0.01 -4.21 -0.02 0 0 Z"
                fill="#D9F23F"
                transform="translate(814.6875,337.734375)"
              />
            </svg>
          </div>
        </div>

        {/* Wordmark */}
        <div className="aw-ls-wordmark">AwareOne</div>

        {/* Dot loader */}
        <div style={{ display: 'flex', gap: 7, marginTop: 18 }}>
          <div className="aw-ls-dot" />
          <div className="aw-ls-dot" />
          <div className="aw-ls-dot" />
        </div>
      </div>
    </div>
  </>
);

export default LoadingScreen;
