/**
 * lunar-javascript 的最小类型声明（该包未附带 .d.ts，且是 UMD/CJS 包）。
 *
 * 注意：不要用 `import { Solar } from 'lunar-javascript'` ——
 * 该包的导出是运行时构造的 `module.exports = {...}`，Vite 的静态
 * named-export 分析拿不到 Solar，运行时是 undefined，页面直接白屏。
 * 必须用默认导入再解构。
 */
declare module 'lunar-javascript' {
  export interface SolarInstance {
    getLunar(): LunarInstance
    /** 公历节日，如 ['元旦节'] */
    getFestivals(): string[]
  }

  export interface SolarStatic {
    fromDate(date: Date): SolarInstance
    fromYmd(year: number, month: number, day: number): SolarInstance
  }

  export interface LunarInstance {
    /** 如：二〇二六年八月初一 */
    toString(): string
    getMonthInChinese(): string
    getDayInChinese(): string
    /** 当天节气名，非节气日返回空串 */
    getJieQi(): string
    /** 农历节日，如 ['中秋节'] */
    getFestivals(): string[]
    /** 干支纪年，如 丙午 */
    getYearInGanZhi(): string
    /** 生肖，如 马 */
    getYearShengXiao(): string
  }

  const lunar: {
    Solar: SolarStatic
  }

  export default lunar
}
