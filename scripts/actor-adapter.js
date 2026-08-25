import { MODULE_ID } from "./constants.js";

export class ActorAdapter {
  constructor(actor) { this.actor = actor; }
  static POOLS = ["might", "speed", "intellect", "additional"];
  get system() { return this.actor.system; }
  getXP() { return Number(this.system?.basic?.xp ?? 0); }
  getTier() { return Number(this.system?.basic?.tier ?? 1); }
  getEffort() { return Number(this.system?.basic?.effort ?? 1); }
  getPool(poolKey) { const p=this.system?.pools?.[poolKey]; return p ? {value:Number(p.value??0),max:Number(p.max??0),edge:Number(p.edge??0)} : null; }
  async spendXP(amount) { const next=Math.max(0,this.getXP()-Number(amount)); await this.actor.update({"system.basic.xp":next}); return next; }
  async grantXP(amount) { const next=this.getXP()+Number(amount); await this.actor.update({"system.basic.xp":next}); return next; }
  async setTier(tier) { await this.actor.update({"system.basic.tier":Number(tier)}); }
  async increasePoolMax(poolKey, amount) { const p=this.getPool(poolKey); if(!p) throw new Error(`Unknown pool: ${poolKey}`); const n=Number(amount); if(!Number.isFinite(n)||n===0)return null; await this.actor.update({[`system.pools.${poolKey}.max`]:p.max+n,[`system.pools.${poolKey}.value`]:p.value+n}); return {max:p.max+n,value:p.value+n}; }
  async increaseEdge(poolKey, amount=1) { const p=this.getPool(poolKey); if(!p)throw new Error(`Unknown pool: ${poolKey}`); const next=p.edge+Number(amount); await this.actor.update({[`system.pools.${poolKey}.edge`]:next}); return next; }
  async increaseEffort(amount=1) { const next=this.getEffort()+Number(amount); await this.actor.update({"system.basic.effort":next}); return next; }
  async improveRecoveryRoll(bonus=2) { const cur=String(this.system?.combat?.recoveries?.roll??"1d6"); const next=ActorAdapter.appendFlatBonus(cur,bonus); await this.actor.update({"system.combat.recoveries.roll":next}); return next; }
  static appendFlatBonus(formula, bonus) { const m=String(formula).match(/^(.*?)([+-]\d+)?$/); const core=m?m[1]:formula; const existing=m&&m[2]?parseInt(m[2],10):0; const total=existing+Number(bonus); return total===0?core:`${core}${total>0?"+":""}${total}`; }
  async improveArmorUse() { const cur=Number(this.system?.combat?.armor?.costTotal??0); const next=Math.max(0,cur-1); await this.actor.update({"system.combat.armor.costTotal":next}); return next; }
  getDevelopmentFlags() { return this.actor.getFlag(MODULE_ID,"data")??null; }
  async setDevelopmentFlags(data) { return this.actor.setFlag(MODULE_ID,"data",data); }
}
