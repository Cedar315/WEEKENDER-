/** Original code-native illustration; shared across the travel scrapbook UI. */
export function TravelBuddy({
  kind = "bear",
  className = "",
}: {
  kind?: "bear" | "cat";
  className?: string;
}) {
  const cat = kind === "cat";
  return (
    <svg
      className={`travel-buddy ${className}`}
      viewBox="0 0 180 190"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="90" cy="178" rx="52" ry="9" fill="#564A7230" />
      <g
        stroke="#514563"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="116" y="107" width="30" height="49" rx="12" fill="#EDAB7D" />
        <path
          d="M55 155L52 171Q59 181 76 171L81 155M102 155L108 173Q127 179 129 168L121 150"
          fill={cat ? "#FFF8E7" : "#E2B28B"}
        />
        <path
          d="M56 104Q36 129 47 144Q55 148 61 133M119 109Q146 112 145 127Q139 138 120 126"
          fill={cat ? "#FFF8E7" : "#E2B28B"}
        />
        <path
          d="M57 105Q87 90 118 107L128 151Q93 170 53 151Z"
          fill={cat ? "#B9D8A2" : "#BFB1ED"}
        />
        <path
          d="M63 105L68 149M114 106L109 150"
          stroke={cat ? "#729B61" : "#9180BE"}
          strokeWidth="7"
        />
        {cat ? (
          <>
            <path
              d="M40 55L37 15Q39 8 65 35M113 34Q144 4 145 18L140 61"
              fill="#FFF8E7"
            />
            <path
              d="M47 34L51 48L59 38M128 39L137 29L135 48"
              fill="#F5BAB9"
              stroke="none"
            />
          </>
        ) : (
          <>
            <circle cx="47" cy="40" r="21" fill="#E2B28B" />
            <circle cx="133" cy="40" r="21" fill="#E2B28B" />
            <circle cx="47" cy="40" r="10" fill="#F5C4B2" stroke="none" />
            <circle cx="133" cy="40" r="10" fill="#F5C4B2" stroke="none" />
          </>
        )}
        <path
          d="M35 71Q30 26 88 25Q148 23 146 77Q149 113 90 114Q32 115 35 71Z"
          fill={cat ? "#FFF8E7" : "#E2B28B"}
        />
        {!cat && (
          <ellipse
            cx="89"
            cy="85"
            rx="24"
            ry="18"
            fill="#FFF0D7"
            stroke="none"
          />
        )}
        <ellipse cx="53" cy="84" rx="11" ry="6" fill="#F29B98" stroke="none" />
        <ellipse cx="124" cy="84" rx="11" ry="6" fill="#F29B98" stroke="none" />
        <path d="M66 66V72M111 66V72" strokeWidth="5" />
        <path d="M85 79Q90 77 94 79L90 84Z" fill="#514563" strokeWidth="2" />
        <path d="M90 85Q86 93 81 89M90 85Q94 93 99 88" strokeWidth="2.5" />
        {!cat && (
          <>
            <path d="M51 39Q53 14 87 14Q119 13 123 39" fill="#AED09B" />
            <path
              d="M43 41Q88 29 136 41Q134 52 88 48Q49 51 43 41Z"
              fill="#BBDCA9"
            />
            <path d="M78 19L78 31" stroke="#82A474" />
          </>
        )}
        <path
          d="M65 108Q88 120 117 108L104 127L82 118L73 130Z"
          fill={cat ? "#F5B7B2" : "#F8DC86"}
          strokeWidth="2.5"
        />
        <path
          d="M91 134L110 131L115 151L95 155Z"
          fill="#FFF9E9"
          strokeWidth="2"
        />
        <path
          d="M97 141L106 138M99 146L109 143"
          stroke="#B9CDA1"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
export function WeekendScene() {
  return (
    <div className="weekend-scene">
      <div className="scene-heading">
        <span className="scene-tag">WEEKEND CLUB</span>
        <span className="scene-spark">✳</span>
        <h2>
          周末不躺平，
          <br />
          一起去<em>撒个欢！</em>
        </h2>
        <p>带上好奇心，快乐即刻出发。</p>
      </div>
      <svg
        className="scene-landscape"
        viewBox="0 0 500 370"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <circle cx="394" cy="61" r="31" fill="#F9D67A" />
        <path
          d="M383 58v4m20-4v4m-20 10q10 9 20 0"
          stroke="#876346"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <g fill="#FFFCF4">
          <path d="M31 68q-2-13 13-13q3-20 22-16q16 1 16 18q20-4 22 12q-34 10-73-1" />
          <path d="M243 104q-2-10 9-12q3-17 20-13q13 2 13 16q15-3 18 9Z" />
        </g>
        <path d="M-25 262L108 86Q120 76 130 91L281 289" fill="#C9D6BA" />
        <path
          d="M62 144L109 86Q120 76 130 91L171 142L139 130L119 146L98 130Z"
          fill="#FFFAE9"
        />
        <path d="M188 284L320 142Q332 128 345 145L513 285" fill="#ADCAA2" />
        <path
          d="M282 182L320 142Q332 128 345 145L385 180L351 173L336 188L313 169Z"
          fill="#EFF1DC"
        />
        <path
          d="M-10 267Q135 198 277 276Q395 213 518 246V380H-10Z"
          fill="#C7DDA8"
        />
        <path
          d="M-10 319Q156 254 292 317Q440 282 517 293V380H-10Z"
          fill="#B6CE93"
        />
        <path
          d="M236 370Q309 318 263 293Q207 269 240 244"
          stroke="#FFF1CE"
          strokeWidth="37"
          fill="none"
        />
        <g stroke="#719664" strokeWidth="3" strokeLinecap="round">
          <path d="M44 312v-16m-7 10l7 6l8-12M429 277v-15m-7 6l7 8l7-11M354 338v-13m-6 6l6 7l8-10" />
        </g>
        <g fill="#FFF8E7">
          <circle cx="63" cy="341" r="5" />
          <circle cx="415" cy="322" r="5" />
          <circle cx="165" cy="286" r="4" />
        </g>
      </svg>
      <div className="buddy-pair">
        <TravelBuddy />
        <TravelBuddy kind="cat" />
      </div>
      <span className="scene-sticker sticker-one">✦ 收集小快乐</span>
      <span className="scene-sticker sticker-two">LET’S GO! ↗</span>
      <div className="scene-footer">
        <span>✿</span> 今日份任务：去一个没去过的地方。
      </div>
    </div>
  );
}
