import he, { forwardRef as re, createElement as I, useState as R, useRef as ue, useEffect as L, createContext as pe, useContext as we } from "react";
import { Fragment as _twFragment, jsx as _twJsx, jsxs as _twJsxs } from "react/jsx-runtime";
var e = { Fragment: _twFragment, jsx: _twJsx, jsxs: _twJsxs };

/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const ge = (r) => r.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), ye = (r) => r.replace(
  /^([A-Z])|[\s-_]+(\w)/g,
  (n, o, a) => a ? a.toUpperCase() : o.toLowerCase()
), K = (r) => {
  const n = ye(r);
  return n.charAt(0).toUpperCase() + n.slice(1);
}, ae = (...r) => r.filter((n, o, a) => !!n && n.trim() !== "" && a.indexOf(n) === o).join(" ").trim(), je = (r) => {
  for (const n in r)
    if (n.startsWith("aria-") || n === "role" || n === "title")
      return !0;
};
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var be = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Ne = re(
  ({
    color: r = "currentColor",
    size: n = 24,
    strokeWidth: o = 2,
    absoluteStrokeWidth: a,
    className: l = "",
    children: s,
    iconNode: m,
    ...h
  }, d) => I(
    "svg",
    {
      ref: d,
      ...be,
      width: n,
      height: n,
      stroke: r,
      strokeWidth: a ? Number(o) * 24 / Number(n) : o,
      className: ae("lucide", l),
      ...!s && !je(h) && { "aria-hidden": "true" },
      ...h
    },
    [
      ...m.map(([x, j]) => I(x, j)),
      ...Array.isArray(s) ? s : [s]
    ]
  )
);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const v = (r, n) => {
  const o = re(
    ({ className: a, ...l }, s) => I(Ne, {
      ref: s,
      iconNode: n,
      className: ae(
        `lucide-${ge(K(r))}`,
        `lucide-${r}`,
        a
      ),
      ...l
    })
  );
  return o.displayName = K(r), o;
};
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const ke = [
  ["path", { d: "m16 3 4 4-4 4", key: "1x1c3m" }],
  ["path", { d: "M20 7H4", key: "zbl0bi" }],
  ["path", { d: "m8 21-4-4 4-4", key: "h9nckh" }],
  ["path", { d: "M4 17h16", key: "g4d7ey" }]
], Se = v("arrow-right-left", ke);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Ee = [["path", { d: "m15 18-6-6 6-6", key: "1wnfg3" }]], Re = v("chevron-left", Ee);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Ce = [["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }]], Me = v("chevron-right", Ce);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Te = [
  ["path", { d: "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242", key: "1pljnt" }],
  ["path", { d: "M16 17H7", key: "pygtm1" }],
  ["path", { d: "M17 21H9", key: "1u2q02" }]
], $e = v("cloud-fog", Te);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Ae = [
  ["path", { d: "M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973", key: "1cez44" }],
  ["path", { d: "m13 12-3 5h4l-3 5", key: "1t22er" }]
], Pe = v("cloud-lightning", Ae);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Oe = [
  ["path", { d: "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242", key: "1pljnt" }],
  ["path", { d: "M8 15h.01", key: "a7atzg" }],
  ["path", { d: "M8 19h.01", key: "puxtts" }],
  ["path", { d: "M12 17h.01", key: "p32p05" }],
  ["path", { d: "M12 21h.01", key: "h35vbk" }],
  ["path", { d: "M16 15h.01", key: "rnfrdf" }],
  ["path", { d: "M16 19h.01", key: "1vcnzz" }]
], Le = v("cloud-snow", Oe);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const ze = [
  ["path", { d: "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242", key: "1pljnt" }],
  ["path", { d: "M16 14v6", key: "1j4efv" }],
  ["path", { d: "M8 14v6", key: "17c4r9" }],
  ["path", { d: "M12 16v6", key: "c8a4gj" }]
], We = v("cloud-rain", ze);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const De = [
  ["path", { d: "M12 2v2", key: "tus03m" }],
  ["path", { d: "m4.93 4.93 1.41 1.41", key: "149t6j" }],
  ["path", { d: "M20 12h2", key: "1q8mjw" }],
  ["path", { d: "m19.07 4.93-1.41 1.41", key: "1shlcs" }],
  ["path", { d: "M15.947 12.65a4 4 0 0 0-5.925-4.128", key: "dpwdj0" }],
  ["path", { d: "M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z", key: "s09mg5" }]
], Fe = v("cloud-sun", De);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const He = [
  ["path", { d: "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z", key: "p7xjir" }]
], ee = v("cloud", He);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Ie = [
  [
    "path",
    {
      d: "M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z",
      key: "1ptgy4"
    }
  ],
  [
    "path",
    {
      d: "M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97",
      key: "1sl1rz"
    }
  ]
], Ye = v("droplets", Ie);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Ue = [
  [
    "path",
    {
      d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
      key: "1r0f0z"
    }
  ],
  ["circle", { cx: "12", cy: "10", r: "3", key: "ilqhr7" }]
], qe = v("map-pin", Ue);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Ve = [
  [
    "path",
    {
      d: "M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",
      key: "kfwtm"
    }
  ]
], Ge = v("moon", Ve);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Ze = [
  ["path", { d: "M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", key: "14sxne" }],
  ["path", { d: "M3 3v5h5", key: "1xhq8a" }],
  ["path", { d: "M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16", key: "1hlbsb" }],
  ["path", { d: "M16 16h5v5", key: "ccwih5" }]
], Je = v("refresh-ccw", Ze);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Qe = [
  ["path", { d: "m21 21-4.34-4.34", key: "14j7rj" }],
  ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }]
], Be = v("search", Qe);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Xe = [
  ["circle", { cx: "12", cy: "12", r: "4", key: "4exip2" }],
  ["path", { d: "M12 2v2", key: "tus03m" }],
  ["path", { d: "M12 20v2", key: "1lh1kg" }],
  ["path", { d: "m4.93 4.93 1.41 1.41", key: "149t6j" }],
  ["path", { d: "m17.66 17.66 1.41 1.41", key: "ptbguv" }],
  ["path", { d: "M2 12h2", key: "1t8f8n" }],
  ["path", { d: "M20 12h2", key: "1q8mjw" }],
  ["path", { d: "m6.34 17.66-1.41 1.41", key: "1m8zz5" }],
  ["path", { d: "m19.07 4.93-1.41 1.41", key: "1shlcs" }]
], te = v("sun", Xe);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Ke = [
  ["path", { d: "M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z", key: "17jzev" }]
], et = v("thermometer", Ke);
/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const tt = [
  ["path", { d: "M12.8 19.6A2 2 0 1 0 14 16H2", key: "148xed" }],
  ["path", { d: "M17.5 8a2.5 2.5 0 1 1 2 4H2", key: "1u4tom" }],
  ["path", { d: "M9.8 4.4A2 2 0 1 1 11 8H2", key: "75valh" }]
], rt = v("wind", tt), at = async (r, n = "zh") => {
  if (!r || r.length < 2) return [];
  const o = new URLSearchParams({
    name: r,
    count: "5",
    language: n,
    // Pass language to API
    format: "json"
  });
  try {
    const a = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${o.toString()}`);
    return a.ok ? (await a.json()).results || [] : [];
  } catch (a) {
    return console.error("Geocoding error:", a), [];
  }
}, O = (r, n = "zh") => (n === "en" ? {
  0: "Clear",
  1: "Mainly Clear",
  2: "Partly Cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime Fog",
  51: "Light Drizzle",
  53: "Drizzle",
  55: "Heavy Drizzle",
  61: "Light Rain",
  63: "Rain",
  65: "Heavy Rain",
  66: "Freezing Rain",
  67: "Heavy Freezing Rain",
  71: "Light Snow",
  73: "Snow",
  75: "Heavy Snow",
  77: "Snow Grains",
  80: "Showers",
  81: "Heavy Showers",
  82: "Violent Showers",
  85: "Snow Showers",
  86: "Heavy Snow Showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ Hail",
  99: "Heavy Thunderstorm"
} : {
  0: "晴",
  1: "晴间多云",
  2: "多云",
  3: "阴",
  45: "雾",
  48: "冻雾",
  51: "毛毛雨",
  53: "小雨",
  55: "中雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "强冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "雪粒",
  80: "阵雨",
  81: "中阵雨",
  82: "暴雨",
  85: "阵雪",
  86: "大阵雪",
  95: "雷雨",
  96: "雷雨伴冰雹",
  99: "强雷雨伴冰雹"
})[r] || (n === "en" ? "Unknown" : "未知"), Y = {
  zh: {
    airQuality: "空气质量",
    excellent: "优",
    good: "良",
    updatedAt: "更新于",
    details: "天气详情",
    feelsLike: "体感温度",
    humidity: "湿度",
    wind: "风力",
    searchPlaceholder: "输入城市名搜索...",
    searching: "搜索中...",
    noResults: "未找到相关结果",
    enterLocation: "请输入地名进行切换",
    unknown: "未知",
    weekDays: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
    today: "今天",
    demoTitle: "tactile-weather 组件库",
    demoSubtitle: "高保真 React 天气 UI 组件",
    sectionStandard: "标准尺寸",
    sectionPanoramic: "全景尺寸",
    sectionCompact: "紧凑尺寸",
    sizeLarge: "Large (4x4)",
    sizeMedium: "Medium (4x2)",
    sizeWideMedium: "Wide Medium (4x1)",
    sizeWideSmall: "Wide Small (2x1)",
    sizeSmall: "Small (2x2)",
    sizeMini: "Mini (1x1)",
    sizeMicro: "Micro (1x0.5)"
  },
  en: {
    airQuality: "Air Quality",
    excellent: "Exc",
    good: "Good",
    updatedAt: "Updated",
    details: "Details",
    feelsLike: "Feels Like",
    humidity: "Humidity",
    wind: "Wind",
    searchPlaceholder: "Search city...",
    searching: "Searching...",
    noResults: "No results found",
    enterLocation: "Enter location to switch",
    unknown: "Unknown",
    weekDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    today: "Today",
    demoTitle: "Tactile Weather Component Library",
    demoSubtitle: "High-fidelity React Weather UI Components",
    sectionStandard: "Standard Sizes",
    sectionPanoramic: "Panoramic Sizes",
    sectionCompact: "Compact Sizes",
    sizeLarge: "Large (4x4)",
    sizeMedium: "Medium (4x2)",
    sizeWideMedium: "Wide Medium (4x1)",
    sizeWideSmall: "Wide Small (2x1)",
    sizeSmall: "Small (2x2)",
    sizeMini: "Mini (1x1)",
    sizeMicro: "Micro (1x0.5)"
  }
}, st = ({
  locationName: r,
  unit: n,
  onToggleUnit: o,
  onRefresh: a,
  onLocationSelect: l,
  size: s = "large",
  lang: m
}) => {
  const [h, d] = R(!1), [x, j] = R(""), [g, _] = R([]), [c, S] = R(!1), y = ue(null), b = Y[m];
  L(() => {
    const u = (M) => {
      y.current && !y.current.contains(M.target) && d(!1);
    };
    return document.addEventListener("mousedown", u), () => document.removeEventListener("mousedown", u);
  }, []), L(() => {
    const u = setTimeout(async () => {
      if (x.trim().length >= 2) {
        S(!0);
        const M = await at(x, m);
        _(M), S(!1);
      } else
        _([]);
    }, 500);
    return () => clearTimeout(u);
  }, [x, m]);
  const C = (u) => {
    l && l({
      name: u.name,
      lat: u.latitude,
      lon: u.longitude,
      country: u.country,
      admin1: u.admin1
    }), d(!1), j(""), _([]);
  };
  if (s === "mini" || s === "wide-small" || s === "wide-medium" || s === "micro")
    return null;
  const N = s === "small";
  return /* @__PURE__ */ e.jsxs("div", { className: `flex flex-col w-full relative z-20 ${N ? "mb-2" : "mb-6"}`, children: [
    /* @__PURE__ */ e.jsx("div", { className: `flex justify-center ${N ? "mb-0" : "mb-6"}`, children: /* @__PURE__ */ e.jsx("h1", { className: `text-[var(--twx-text-secondary)] font-medium tracking-wide drop-shadow-[var(--twx-text-shadow)] truncate px-2
          ${N ? "text-base" : "text-xl"}
        `, children: r }) }),
    !N && /* @__PURE__ */ e.jsxs("div", { className: "flex items-center justify-between relative", children: [
      /* @__PURE__ */ e.jsxs("div", { className: "flex items-center gap-3 select-none", children: [
        /* @__PURE__ */ e.jsx(
          "span",
          {
            className: `text-sm font-bold transition-colors cursor-pointer drop-shadow-[var(--twx-text-shadow)] ${n === "C" ? "text-[var(--twx-text-secondary)]" : "text-[var(--twx-text-muted)]"}`,
            onClick: () => n === "F" && o(),
            children: "°C"
          }
        ),
        /* @__PURE__ */ e.jsx(
          "div",
          {
            onClick: o,
            className: `relative w-14 h-8 bg-[var(--twx-bg-switch)] rounded-full p-1 cursor-pointer \r
                shadow-[inset_0_3px_6px_var(--twx-shadow-medium),inset_0_1px_2px_var(--twx-shadow-medium),0_1px_0_var(--twx-highlight-strong)] \r
                flex items-center border-t border-[var(--twx-border-light)]`,
            children: /* @__PURE__ */ e.jsx(
              "div",
              {
                className: `
                   w-6 h-6 bg-gradient-to-b from-[var(--twx-bg-switch-knob)] to-[var(--twx-bg-input)] rounded-full 
                   shadow-[0_2px_4px_var(--twx-shadow-subtle),0_4px_8px_var(--twx-shadow-subtle),inset_0_1px_0_var(--twx-highlight-strong)] 
                   border border-[var(--twx-border-light)]
                   transform transition-transform duration-300 ease-out z-10
                   flex items-center justify-center
                   ${n === "F" ? "translate-x-[1.5rem]" : "translate-x-0"}
                 `,
                children: /* @__PURE__ */ e.jsx("div", { className: "w-1.5 h-1.5 rounded-full bg-[var(--twx-divider)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.3),0_1px_0_var(--twx-highlight-strong)]" })
              }
            )
          }
        ),
        /* @__PURE__ */ e.jsx(
          "span",
          {
            className: `text-sm font-bold transition-colors cursor-pointer drop-shadow-[var(--twx-text-shadow)] ${n === "F" ? "text-[var(--twx-text-secondary)]" : "text-[var(--twx-text-muted)]"}`,
            onClick: () => n === "C" && o(),
            children: "°F"
          }
        )
      ] }),
      /* @__PURE__ */ e.jsxs("div", { className: "flex gap-4 relative", ref: y, children: [
        /* @__PURE__ */ e.jsx(
          "button",
          {
            onClick: a,
            className: `w-10 h-10 bg-gradient-to-b from-[var(--twx-bg-button)] to-[var(--twx-bg-button-hover)] rounded-full \r
                shadow-[0_2px_5px_var(--twx-shadow-subtle),0_1px_0_var(--twx-highlight-strong)_inset,inset_0_0_2px_var(--twx-highlight)] \r
                border border-[var(--twx-border-light)] \r
                active:bg-[var(--twx-bg-item-hover)]\r
                active:shadow-[inset_0_2px_4px_var(--twx-shadow-medium),0_1px_0_var(--twx-highlight)] \r
                active:border-transparent\r
                flex items-center justify-center text-[var(--twx-text-secondary)] hover:text-[var(--twx-text-primary)] transition-all active:translate-y-[1px]`,
            children: /* @__PURE__ */ e.jsx(Je, { size: 18, className: "drop-shadow-[var(--twx-text-shadow)]" })
          }
        ),
        /* @__PURE__ */ e.jsx(
          "button",
          {
            onClick: () => d(!h),
            className: `w-10 h-10 bg-gradient-to-b from-[var(--twx-bg-button)] to-[var(--twx-bg-button-hover)] rounded-full 
                shadow-[0_2px_5px_var(--twx-shadow-subtle),0_1px_0_var(--twx-highlight-strong)_inset,inset_0_0_2px_var(--twx-highlight)] 
                border border-[var(--twx-border-light)] 
                active:bg-[var(--twx-bg-item-hover)]
                active:shadow-[inset_0_2px_4px_var(--twx-shadow-medium),0_1px_0_var(--twx-highlight)] 
                active:border-transparent
                flex items-center justify-center transition-all active:translate-y-[1px]
                ${h ? "text-[var(--twx-accent-success)]" : "text-[var(--twx-text-secondary)] hover:text-[var(--twx-text-primary)]"}
                `,
            children: /* @__PURE__ */ e.jsx(Se, { size: 18, className: "drop-shadow-[var(--twx-text-shadow)]" })
          }
        ),
        h && /* @__PURE__ */ e.jsxs("div", { className: "absolute top-12 right-0 w-72 bg-[var(--twx-bg-panel)] rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)] p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200", children: [
          /* @__PURE__ */ e.jsx("div", { className: "absolute -top-2 right-3 w-4 h-4 bg-[var(--twx-bg-panel)] rotate-45 border-l border-t border-[var(--twx-border-light)]" }),
          /* @__PURE__ */ e.jsxs("div", { className: "relative mb-2", children: [
            /* @__PURE__ */ e.jsx(Be, { size: 14, className: "absolute left-3 top-1/2 -translate-y-1/2 text-[var(--twx-text-muted)]" }),
            /* @__PURE__ */ e.jsx(
              "input",
              {
                type: "text",
                value: x,
                onChange: (u) => j(u.target.value),
                placeholder: b.searchPlaceholder,
                className: `w-full bg-[var(--twx-bg-input)] text-sm text-[var(--twx-text-primary)] pl-9 pr-3 py-2 rounded-lg \r
                      shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] \r
                      focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:bg-white transition-all\r
                      placeholder:text-[var(--twx-text-muted)]`,
                autoFocus: !0
              }
            )
          ] }),
          /* @__PURE__ */ e.jsx("div", { className: "max-h-60 overflow-y-auto no-scrollbar", children: c ? /* @__PURE__ */ e.jsx("div", { className: "p-4 text-center text-xs text-[var(--twx-text-muted)]", children: b.searching }) : g.length > 0 ? /* @__PURE__ */ e.jsx("ul", { className: "flex flex-col gap-1", children: g.map((u) => /* @__PURE__ */ e.jsxs(
            "li",
            {
              onClick: () => C(u),
              className: "px-3 py-2 rounded-lg hover:bg-[var(--twx-bg-item-hover)] cursor-pointer flex items-center gap-3 transition-colors group",
              children: [
                /* @__PURE__ */ e.jsx("div", { className: "w-8 h-8 rounded-full bg-[var(--twx-bg-input)] flex items-center justify-center text-[var(--twx-text-muted)] group-hover:bg-[var(--twx-bg-widget)] group-hover:shadow-sm transition-all", children: /* @__PURE__ */ e.jsx(qe, { size: 14 }) }),
                /* @__PURE__ */ e.jsxs("div", { className: "flex flex-col min-w-0", children: [
                  /* @__PURE__ */ e.jsx("span", { className: "text-sm font-medium text-[var(--twx-text-primary)] truncate", children: u.name }),
                  /* @__PURE__ */ e.jsx("span", { className: "text-xs text-[var(--twx-text-muted)] truncate", children: [u.admin1, u.country].filter(Boolean).join(", ") })
                ] })
              ]
            },
            u.id
          )) }) : x.length >= 2 ? /* @__PURE__ */ e.jsx("div", { className: "p-4 text-center text-xs text-[var(--twx-text-muted)]", children: b.noResults }) : /* @__PURE__ */ e.jsx("div", { className: "p-2 text-center text-xs text-[var(--twx-text-muted)]", children: b.enterLocation }) })
        ] })
      ] })
    ] })
  ] });
}, k = ({ code: r, isDay: n = 1, className: o, size: a = 24, strokeWidth: l = 2.5 }) => {
  const s = {
    size: a,
    className: o,
    strokeWidth: l
  };
  return r === 0 || r === 1 ? n ? /* @__PURE__ */ e.jsx(te, { ...s }) : /* @__PURE__ */ e.jsx(Ge, { ...s }) : r === 2 ? n ? /* @__PURE__ */ e.jsx(Fe, { ...s }) : /* @__PURE__ */ e.jsx(ee, { ...s }) : r === 3 ? /* @__PURE__ */ e.jsx(ee, { ...s }) : r >= 45 && r <= 48 ? /* @__PURE__ */ e.jsx($e, { ...s }) : r >= 51 && r <= 67 ? /* @__PURE__ */ e.jsx(We, { ...s }) : r >= 71 && r <= 77 ? /* @__PURE__ */ e.jsx(Le, { ...s }) : r >= 95 ? /* @__PURE__ */ e.jsx(Pe, { ...s }) : /* @__PURE__ */ e.jsx(te, { ...s });
}, nt = ({
  data: r,
  loading: n,
  unit: o,
  size: a = "large",
  locationName: l,
  lang: s
}) => {
  const [m, h] = R("main"), d = Y[s], x = () => {
    switch (a) {
      case "medium":
        return "h-44";
      case "small":
        return "h-36";
      case "mini":
      case "wide-small":
      // 2x1
      case "wide-medium":
        return "h-24";
      case "micro":
        return "h-12";
      // 1x0.5
      default:
        return "h-80";
    }
  }, j = () => a === "small" || a === "mini" || a === "wide-small" || a === "wide-medium" || a === "micro" ? "shadow-[0_10px_20px_-5px_var(--twx-shadow-subtle),inset_0_2px_4px_var(--twx-shadow-inner),inset_0_1px_2px_var(--twx-shadow-subtle),0_1px_0_var(--twx-highlight-strong)]" : "shadow-[0_25px_50px_-12px_var(--twx-shadow-medium),inset_0_4px_8px_var(--twx-shadow-inner),inset_0_1px_2px_var(--twx-shadow-subtle),0_1px_0_var(--twx-highlight-strong)]", g = () => `relative w-full ${x()} bg-[var(--twx-bg-widget)] 
      ${j()}
      border border-[var(--twx-border-light)] overflow-hidden transition-all duration-500 ease-in-out`, _ = a === "mini" || a === "wide-small" || a === "wide-medium" || a === "micro" ? "rounded-[4px]" : a === "small" ? "rounded-[5px]" : "rounded-[6px]";
  if (n || !r)
    return /* @__PURE__ */ e.jsx("div", { className: `${g()} ${_} animate-pulse flex items-center justify-center`, children: /* @__PURE__ */ e.jsx("span", { className: "text-gray-400 font-light drop-shadow-[var(--twx-text-shadow)] text-sm", children: "..." }) });
  const { current_weather: c, hourly: S } = r, y = Math.round(o === "C" ? c.temperature : c.temperature * 9 / 5 + 32), b = (/* @__PURE__ */ new Date()).getHours(), C = S.relative_humidity_2m[b] || 50, N = S.apparent_temperature[b] || c.temperature, u = Math.round(o === "C" ? N : N * 9 / 5 + 32);
  return a === "micro" ? /* @__PURE__ */ e.jsxs("div", { className: `${g()} ${_} flex items-center justify-between px-3`, children: [
    /* @__PURE__ */ e.jsx("span", { className: "text-[10px] font-medium text-[var(--twx-text-tertiary)] truncate max-w-[45%] drop-shadow-[var(--twx-text-shadow)]", children: l }),
    /* @__PURE__ */ e.jsxs("div", { className: "flex items-center gap-1.5", children: [
      /* @__PURE__ */ e.jsx("div", { className: "filter drop-shadow-sm", children: /* @__PURE__ */ e.jsx(
        k,
        {
          code: c.weathercode,
          isDay: c.is_day,
          size: 18,
          strokeWidth: 2.5,
          className: "text-[var(--twx-text-primary)]"
        }
      ) }),
      /* @__PURE__ */ e.jsxs("span", { className: "text-sm font-semibold text-[var(--twx-text-primary)] drop-shadow-[var(--twx-text-shadow)] leading-none", children: [
        y,
        "°"
      ] })
    ] })
  ] }) : a === "mini" ? /* @__PURE__ */ e.jsxs("div", { className: `${g()} ${_} flex flex-col items-center justify-center py-2 px-1`, children: [
    /* @__PURE__ */ e.jsx("span", { className: "text-[11px] font-medium text-[var(--twx-text-tertiary)] mb-1 drop-shadow-[var(--twx-text-shadow)] truncate max-w-full", children: l }),
    /* @__PURE__ */ e.jsx("div", { className: "filter drop-shadow-sm mb-0.5", children: /* @__PURE__ */ e.jsx(
      k,
      {
        code: c.weathercode,
        isDay: c.is_day,
        size: 26,
        strokeWidth: 2.5,
        className: "text-[var(--twx-text-primary)]"
      }
    ) }),
    /* @__PURE__ */ e.jsxs("span", { className: "text-lg font-semibold text-[var(--twx-text-primary)] drop-shadow-[var(--twx-text-shadow)] leading-none", children: [
      y,
      "°"
    ] })
  ] }) : a === "wide-small" ? /* @__PURE__ */ e.jsxs("div", { className: `${g()} ${_} flex items-center justify-between px-5`, children: [
    /* @__PURE__ */ e.jsx("div", { className: "filter drop-shadow-sm", children: /* @__PURE__ */ e.jsx(
      k,
      {
        code: c.weathercode,
        isDay: c.is_day,
        size: 50,
        strokeWidth: 2,
        className: "text-[var(--twx-text-primary)]"
      }
    ) }),
    /* @__PURE__ */ e.jsxs("div", { className: "flex flex-col items-end justify-center", children: [
      /* @__PURE__ */ e.jsx("span", { className: "text-xs font-medium text-[var(--twx-text-tertiary)] drop-shadow-[var(--twx-text-shadow)] mb-0.5", children: l }),
      /* @__PURE__ */ e.jsxs("div", { className: "flex items-start", children: [
        /* @__PURE__ */ e.jsx("span", { className: "text-3xl font-light text-[var(--twx-text-primary)] drop-shadow-[var(--twx-text-shadow)] leading-none", children: y }),
        /* @__PURE__ */ e.jsx("span", { className: "text-lg text-[var(--twx-text-secondary)] ml-0.5 leading-none", children: "°" })
      ] })
    ] })
  ] }) : a === "wide-medium" ? /* @__PURE__ */ e.jsxs("div", { className: `${g()} ${_} flex items-center justify-between px-6`, children: [
    /* @__PURE__ */ e.jsxs("div", { className: "flex items-center gap-4", children: [
      /* @__PURE__ */ e.jsx("div", { className: "filter drop-shadow-md", children: /* @__PURE__ */ e.jsx(
        k,
        {
          code: c.weathercode,
          isDay: c.is_day,
          size: 60,
          strokeWidth: 2,
          className: "text-[var(--twx-text-primary)]"
        }
      ) }),
      /* @__PURE__ */ e.jsxs("div", { className: "flex items-start", children: [
        /* @__PURE__ */ e.jsx("span", { className: "text-5xl font-light tracking-tighter text-[var(--twx-text-emphasis)] drop-shadow-[var(--twx-text-shadow)]", children: y }),
        /* @__PURE__ */ e.jsx("span", { className: "text-2xl mt-1 font-light text-[var(--twx-text-secondary)]", children: "°" })
      ] })
    ] }),
    /* @__PURE__ */ e.jsxs("div", { className: "flex flex-col items-end", children: [
      /* @__PURE__ */ e.jsx("span", { className: "text-lg font-medium text-[var(--twx-text-icon)] drop-shadow-[var(--twx-text-shadow)]", children: l }),
      /* @__PURE__ */ e.jsxs("div", { className: "flex items-center gap-2 text-sm text-[var(--twx-text-tertiary)]", children: [
        /* @__PURE__ */ e.jsx("span", { children: O(c.weathercode, s) }),
        /* @__PURE__ */ e.jsx("span", { className: "w-px h-3 bg-[var(--twx-divider)]" }),
        /* @__PURE__ */ e.jsxs("span", { children: [
          "H:",
          Math.round(r.daily.temperature_2m_max[0]),
          "° L:",
          Math.round(r.daily.temperature_2m_min[0]),
          "°"
        ] })
      ] })
    ] })
  ] }) : a === "small" ? /* @__PURE__ */ e.jsxs("div", { className: `${g()} ${_} flex flex-col items-center justify-center gap-1 py-3`, children: [
    /* @__PURE__ */ e.jsx("div", { className: "filter drop-shadow-md", children: /* @__PURE__ */ e.jsx(
      k,
      {
        code: c.weathercode,
        isDay: c.is_day,
        size: 60,
        strokeWidth: 2,
        className: "text-[var(--twx-text-primary)]"
      }
    ) }),
    /* @__PURE__ */ e.jsxs("div", { className: "flex items-start -mr-2", children: [
      /* @__PURE__ */ e.jsx("span", { className: "text-4xl font-light tracking-tighter text-[var(--twx-text-emphasis)] drop-shadow-[var(--twx-text-shadow)]", children: y }),
      /* @__PURE__ */ e.jsx("span", { className: "text-lg mt-1 text-[var(--twx-text-secondary)]", children: "°" })
    ] }),
    /* @__PURE__ */ e.jsx("span", { className: "text-xs text-[var(--twx-text-tertiary)] drop-shadow-[var(--twx-text-shadow)]", children: O(c.weathercode, s) })
  ] }) : a === "medium" ? /* @__PURE__ */ e.jsxs("div", { className: `${g()} ${_} flex items-center px-6 justify-between`, children: [
    /* @__PURE__ */ e.jsx("div", { className: "filter drop-shadow-md", children: /* @__PURE__ */ e.jsx(
      k,
      {
        code: c.weathercode,
        isDay: c.is_day,
        size: 100,
        strokeWidth: 1.5,
        className: "text-[var(--twx-text-primary)]"
      }
    ) }),
    /* @__PURE__ */ e.jsxs("div", { className: "flex flex-col items-end", children: [
      /* @__PURE__ */ e.jsxs("div", { className: "flex items-start", children: [
        /* @__PURE__ */ e.jsx("span", { className: "text-6xl font-light tracking-tighter text-[var(--twx-text-emphasis)] drop-shadow-[var(--twx-text-shadow)]", children: y }),
        /* @__PURE__ */ e.jsx("span", { className: "text-2xl mt-2 font-light text-[var(--twx-text-secondary)]", children: "°" })
      ] }),
      /* @__PURE__ */ e.jsxs("div", { className: "flex items-center gap-3 text-sm text-[var(--twx-text-secondary)] drop-shadow-[var(--twx-text-shadow)]", children: [
        /* @__PURE__ */ e.jsx("span", { children: O(c.weathercode, s) }),
        /* @__PURE__ */ e.jsx("span", { className: "w-px h-3 bg-[var(--twx-divider)]" }),
        /* @__PURE__ */ e.jsxs("span", { children: [
          d.airQuality,
          " ",
          d.excellent
        ] })
      ] })
    ] })
  ] }) : /* @__PURE__ */ e.jsxs("div", { className: `${g()} ${_}`, children: [
    m === "main" && /* @__PURE__ */ e.jsx(
      "button",
      {
        onClick: () => h("detail"),
        className: "absolute right-6 top-0 bottom-0 flex items-center justify-center z-10 group cursor-pointer",
        children: /* @__PURE__ */ e.jsx(Me, { size: 28, className: "text-gray-300 group-hover:text-gray-400 transition-colors drop-shadow-[var(--twx-text-shadow)]" })
      }
    ),
    m === "detail" && /* @__PURE__ */ e.jsx(
      "button",
      {
        onClick: () => h("main"),
        className: "absolute left-4 top-0 bottom-0 w-12 flex items-center justify-center z-10 group cursor-pointer",
        children: /* @__PURE__ */ e.jsx(Re, { size: 28, className: "text-gray-300 group-hover:text-gray-400 transition-colors drop-shadow-[var(--twx-text-shadow)]" })
      }
    ),
    /* @__PURE__ */ e.jsx("div", { className: "w-full h-full flex flex-col justify-center", children: m === "main" ? (
      /* MAIN VIEW */
      /* @__PURE__ */ e.jsxs("div", { className: "flex items-center justify-center w-full pl-8 pr-16 animate-in fade-in slide-in-from-right-4 duration-300", children: [
        /* @__PURE__ */ e.jsx("div", { className: "flex-1 flex justify-end pr-8", children: /* @__PURE__ */ e.jsx("div", { className: "filter drop-shadow-md", children: /* @__PURE__ */ e.jsx(
          k,
          {
            code: c.weathercode,
            isDay: c.is_day,
            size: 160,
            strokeWidth: 1,
            className: "text-[var(--twx-text-primary)]"
          }
        ) }) }),
        /* @__PURE__ */ e.jsxs("div", { className: "flex-1 flex flex-col items-start space-y-1", children: [
          /* @__PURE__ */ e.jsxs("div", { className: "flex items-start -ml-1", children: [
            /* @__PURE__ */ e.jsx("span", { className: "text-[7rem] leading-none font-light tracking-tighter text-[var(--twx-text-emphasis)] drop-shadow-[var(--twx-text-shadow)] font-[Inter]", children: y }),
            /* @__PURE__ */ e.jsxs("span", { className: "text-3xl mt-4 font-light text-[var(--twx-text-secondary)] drop-shadow-[var(--twx-text-shadow)]", children: [
              "°",
              o
            ] })
          ] }),
          /* @__PURE__ */ e.jsx("p", { className: "text-[var(--twx-text-icon)] text-2xl font-normal tracking-wide drop-shadow-[var(--twx-text-shadow)] pb-2", children: O(c.weathercode, s) }),
          /* @__PURE__ */ e.jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ e.jsx("span", { className: "text-sm text-[var(--twx-text-muted)] drop-shadow-[var(--twx-text-shadow)]", children: d.airQuality }),
            /* @__PURE__ */ e.jsxs("div", { className: "bg-[var(--twx-accent-success)] px-2 py-0.5 rounded-md shadow-[0_1px_1px_var(--twx-shadow-subtle),inset_0_1px_0_var(--twx-highlight)] flex items-center gap-1", children: [
              /* @__PURE__ */ e.jsx("span", { className: "text-white text-xs font-bold drop-shadow-sm", children: d.excellent }),
              /* @__PURE__ */ e.jsx("span", { className: "text-white text-xs font-medium opacity-90", children: "32" })
            ] })
          ] }),
          /* @__PURE__ */ e.jsxs("p", { className: "text-xs text-[var(--twx-text-muted)] mt-1 font-medium drop-shadow-[var(--twx-text-shadow)]", children: [
            d.updatedAt,
            " ",
            (/* @__PURE__ */ new Date()).toLocaleTimeString(s === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit", hour12: !1 })
          ] })
        ] })
      ] })
    ) : (
      /* DETAIL VIEW */
      /* @__PURE__ */ e.jsxs("div", { className: "px-16 animate-in fade-in slide-in-from-left-4 duration-300 h-full flex flex-col justify-center", children: [
        /* @__PURE__ */ e.jsxs("div", { className: "flex items-center gap-3 mb-8 border-b border-[var(--twx-border-light)] pb-4", children: [
          /* @__PURE__ */ e.jsx(
            k,
            {
              code: c.weathercode,
              isDay: c.is_day,
              size: 32,
              strokeWidth: 2,
              className: "text-[var(--twx-text-icon)]"
            }
          ),
          /* @__PURE__ */ e.jsx("span", { className: "text-2xl text-[var(--twx-text-primary)] font-normal drop-shadow-[var(--twx-text-shadow)]", children: d.details })
        ] }),
        /* @__PURE__ */ e.jsxs("div", { className: "grid grid-cols-2 gap-y-8 gap-x-12", children: [
          /* @__PURE__ */ e.jsxs("div", { className: "flex items-center gap-4", children: [
            /* @__PURE__ */ e.jsx("div", { className: "w-10 h-10 rounded-full bg-[var(--twx-bg-input)] flex items-center justify-center shadow-[inset_0_1px_3px_var(--twx-shadow-inner)]", children: /* @__PURE__ */ e.jsx(et, { className: "text-[var(--twx-text-placeholder)]", size: 20 }) }),
            /* @__PURE__ */ e.jsxs("div", { className: "flex flex-col", children: [
              /* @__PURE__ */ e.jsx("span", { className: "text-xs text-[var(--twx-text-muted)] font-medium uppercase tracking-wider", children: d.feelsLike }),
              /* @__PURE__ */ e.jsxs("span", { className: "text-xl text-[var(--twx-text-primary)] font-medium", children: [
                u,
                "°"
              ] })
            ] })
          ] }),
          /* @__PURE__ */ e.jsxs("div", { className: "flex items-center gap-4", children: [
            /* @__PURE__ */ e.jsx("div", { className: "w-10 h-10 rounded-full bg-[var(--twx-bg-input)] flex items-center justify-center shadow-[inset_0_1px_3px_var(--twx-shadow-inner)]", children: /* @__PURE__ */ e.jsx(Ye, { className: "text-[var(--twx-text-placeholder)]", size: 20 }) }),
            /* @__PURE__ */ e.jsxs("div", { className: "flex flex-col", children: [
              /* @__PURE__ */ e.jsx("span", { className: "text-xs text-[var(--twx-text-muted)] font-medium uppercase tracking-wider", children: d.humidity }),
              /* @__PURE__ */ e.jsxs("span", { className: "text-xl text-[var(--twx-text-primary)] font-medium", children: [
                C,
                "%"
              ] })
            ] })
          ] }),
          /* @__PURE__ */ e.jsxs("div", { className: "flex items-center gap-4", children: [
            /* @__PURE__ */ e.jsx("div", { className: "w-10 h-10 rounded-full bg-[var(--twx-bg-input)] flex items-center justify-center shadow-[inset_0_1px_3px_var(--twx-shadow-inner)]", children: /* @__PURE__ */ e.jsx(rt, { className: "text-[var(--twx-text-placeholder)]", size: 20 }) }),
            /* @__PURE__ */ e.jsxs("div", { className: "flex flex-col", children: [
              /* @__PURE__ */ e.jsx("span", { className: "text-xs text-[var(--twx-text-muted)] font-medium uppercase tracking-wider", children: d.wind }),
              /* @__PURE__ */ e.jsxs("span", { className: "text-xl text-[var(--twx-text-primary)] font-medium", children: [
                c.windspeed,
                " km/h"
              ] })
            ] })
          ] })
        ] })
      ] })
    ) })
  ] });
}, ot = ({ data: r, unit: n, lang: o }) => {
  if (!r) return null;
  const { daily: a } = r, l = Y[o], s = (d, x) => {
    if (x === 0) return l.today;
    const j = new Date(d);
    return l.weekDays[j.getDay()];
  }, m = (d) => Math.round(n === "C" ? d : d * 9 / 5 + 32), h = a.time.slice(0, 5).map((d, x) => ({
    time: d,
    code: a.weather_code[x],
    max: a.temperature_2m_max[x],
    min: a.temperature_2m_min[x]
  }));
  return (
    // Matches MainCard shadow style with reduced border radius (now 6px)
    /* @__PURE__ */ e.jsx("div", { className: `w-full bg-[var(--twx-bg-panel)] rounded-[6px] \r
      shadow-[0_15px_30px_var(--twx-shadow-heavy),inset_0_3px_6px_var(--twx-shadow-inner),inset_0_1px_2px_var(--twx-shadow-subtle),0_1px_0_var(--twx-highlight-strong)]\r
      border border-[var(--twx-border-light)] p-6 mt-6`, children: /* @__PURE__ */ e.jsx("div", { className: "flex justify-between items-center px-2", children: h.map((d, x) => /* @__PURE__ */ e.jsxs("div", { className: "flex flex-col items-center justify-between gap-3 flex-1 group cursor-default", children: [
      /* @__PURE__ */ e.jsx("span", { className: `text-sm drop-shadow-[var(--twx-text-shadow)] ${x === 0 ? "text-[var(--twx-text-primary)] font-medium" : "text-[var(--twx-text-muted)]"}`, children: s(d.time, x) }),
      /* @__PURE__ */ e.jsx("div", { className: "my-1 filter drop-shadow-md transition-transform group-hover:scale-110 duration-200", children: /* @__PURE__ */ e.jsx(k, { code: d.code, size: 24, className: "text-[var(--twx-text-secondary)]" }) }),
      /* @__PURE__ */ e.jsxs("div", { className: "flex gap-2 text-sm font-light", children: [
        /* @__PURE__ */ e.jsxs("span", { className: "text-[var(--twx-text-primary)] drop-shadow-[var(--twx-text-shadow)]", children: [
          m(d.max),
          "°"
        ] }),
        /* @__PURE__ */ e.jsxs("span", { className: "text-[var(--twx-text-muted)] drop-shadow-[var(--twx-text-shadow)]", children: [
          m(d.min),
          "°"
        ] })
      ] })
    ] }, d.time)) }) })
  );
}, lt = ({
  size: r,
  data: n,
  loading: o,
  unit: a,
  locationName: l,
  onToggleUnit: s,
  onRefresh: m,
  onLocationSelect: h,
  lang: d
}) => {
  let x = "bg-[var(--twx-bg-widget)] shadow-[0_50px_100px_-20px_var(--twx-shadow-heavy),0_30px_60px_-30px_var(--twx-shadow-medium),inset_0_2px_0_var(--twx-highlight)] relative overflow-hidden flex flex-col items-center";
  return r === "large" ? x += " w-full max-w-md rounded-[12px] p-8" : r === "medium" ? x += " w-full max-w-md rounded-[12px] p-6" : r === "small" ? x += " w-48 rounded-[10px] p-4" : r === "wide-small" ? x += " w-48 rounded-[8px] p-3" : r === "wide-medium" ? x += " w-full max-w-md rounded-[8px] p-3" : r === "mini" ? x += " w-32 rounded-[8px] p-3" : r === "micro" && (x += " w-32 rounded-[8px] p-2"), /* @__PURE__ */ e.jsxs("div", { className: x, children: [
    /* @__PURE__ */ e.jsx(
      st,
      {
        locationName: l,
        unit: a,
        onToggleUnit: s,
        onRefresh: m,
        onLocationSelect: h,
        size: r,
        lang: d
      }
    ),
    /* @__PURE__ */ e.jsxs("div", { className: `w-full ${r === "large" ? "space-y-6" : "space-y-0"}`, children: [
      /* @__PURE__ */ e.jsx(
        nt,
        {
          data: n,
          loading: o,
          unit: a,
          size: r,
          locationName: l,
          lang: d
        }
      ),
      r === "large" && /* @__PURE__ */ e.jsx(ot, { data: n, unit: a, lang: d })
    ] })
  ] });
}, se = pe(void 0), dt = ({
  children: r,
  initialTheme: n = "light",
  customTheme: o
}) => {
  const [a, l] = R(n), s = () => {
    l((m) => m === "light" ? "dark" : "light");
  };
  return L(() => {
    var h;
    document.documentElement.setAttribute("data-theme", a), (h = document.body) == null || h.setAttribute("data-theme", a);
  }, [a]), L(() => {
    const m = document.documentElement;
    return o && Object.entries(o).forEach(([h, d]) => {
      m.style.setProperty(h, d);
    }), () => {
      o && Object.keys(o).forEach((h) => {
        m.style.removeProperty(h);
      });
    };
  }, [o]), /* @__PURE__ */ e.jsx(se.Provider, { value: { theme: a, setTheme: l, toggleTheme: s, customTheme: o }, children: r });
}, ct = () => {
  const r = we(se);
  if (r === void 0)
    throw new Error("useTheme must be used within a ThemeProvider");
  return r;
};
export {
  dt as ThemeProvider,
  lt as WeatherWidget,
  ct as useTheme
};
