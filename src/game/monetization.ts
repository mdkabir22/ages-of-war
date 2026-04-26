import type { GameState } from '../types/game';
import { GOLD_PER_SECOND } from './ages';
import { remoteGameConfig } from '../lib/remoteConfig';

export interface GemOffer {
  id: string;
  title: string;
  gemsCost: number;
  description: string;
}

export interface StoreOffer {
  id: string;
  title: string;
  usdPrice: number;
  gems: number;
  gold: number;
  premiumPass?: boolean;
  adFree?: boolean;
  oneTime?: boolean;
}

const GOLD_MINE_UPGRADE_BASE_COST = 120;
const GOLD_MINE_RATE_PER_LEVEL = 0.12;
const PREMIUM_PASS_RATE_BONUS = 0.15;
const SPEED_BOOST_MULTIPLIER = 2;
const SPEED_BOOST_DURATION_SECONDS = 300;

export const STARTER_PACK: GemOffer = {
  id: 'starter_pack',
  title: 'Starter Pack',
  gemsCost: 0,
  description: 'One-time launch boost: +600 gems, +800 gold, and premium pass.',
};

export const STORE_OFFERS: StoreOffer[] = [
  { id: 'gem_bundle_s', title: 'Gem Bundle S', usdPrice: 0.99, gems: 150, gold: 0 },
  { id: 'gem_bundle_m', title: 'Gem Bundle M', usdPrice: 4.99, gems: 900, gold: 200, oneTime: false },
  { id: 'gem_bundle_l', title: 'Gem Bundle L', usdPrice: 9.99, gems: 2200, gold: 500, oneTime: false },
  { id: 'premium_pass', title: 'Premium Pass', usdPrice: 7.99, gems: 400, gold: 600, premiumPass: true, oneTime: true },
  { id: 'no_ads', title: 'No Ads Forever', usdPrice: 3.99, gems: 150, gold: 0, adFree: true, oneTime: true },
];

export function getGoldMineUpgradeCost(level: number): number {
  const mult = remoteGameConfig.getGoldMineCostMultiplier();
  return Math.floor(GOLD_MINE_UPGRADE_BASE_COST * (1 + level * 0.75) * mult);
}

export function getGoldRatePerSecond(state: GameState, ageBonus: number, currentTime: number): number {
  const mineMultiplier = 1 + state.goldMineLevel * GOLD_MINE_RATE_PER_LEVEL;
  const passMultiplier = state.premiumPass ? 1 + PREMIUM_PASS_RATE_BONUS : 1;
  const speedMultiplier = state.speedBoostUntil > currentTime ? SPEED_BOOST_MULTIPLIER : 1;
  const scale = remoteGameConfig.getGoldEconomyScale();
  return (GOLD_PER_SECOND + ageBonus) * mineMultiplier * passMultiplier * speedMultiplier * scale;
}

export function canBuyGoldMineUpgrade(state: GameState): boolean {
  const cost = getGoldMineUpgradeCost(state.goldMineLevel);
  return state.playerGems >= cost;
}

export function buyGoldMineUpgrade(state: GameState): boolean {
  if (!canBuyGoldMineUpgrade(state)) return false;
  const cost = getGoldMineUpgradeCost(state.goldMineLevel);
  state.playerGems -= cost;
  state.goldMineLevel += 1;
  return true;
}

export function canActivateSpeedBoost(state: GameState, currentTime: number): boolean {
  if (state.speedBoostUntil > currentTime) return false;
  return state.playerGems >= 120;
}

export function activateSpeedBoost(state: GameState, currentTime: number): boolean {
  if (!canActivateSpeedBoost(state, currentTime)) return false;
  state.playerGems -= 120;
  state.speedBoostUntil = currentTime + SPEED_BOOST_DURATION_SECONDS;
  return true;
}

export function canClaimStarterPack(state: GameState): boolean {
  return !state.purchasedOffers.includes(STARTER_PACK.id);
}

export function claimStarterPack(state: GameState): boolean {
  if (!canClaimStarterPack(state)) return false;
  state.playerGems += 600;
  state.playerGold += 800;
  state.premiumPass = true;
  state.purchasedOffers.push(STARTER_PACK.id);
  return true;
}

export function canPurchaseStoreOffer(state: GameState, offerId: string): boolean {
  const offer = STORE_OFFERS.find(item => item.id === offerId);
  if (!offer) return false;
  if (offer.oneTime && state.purchasedOffers.includes(offer.id)) return false;
  return true;
}

function getOfferDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function getOfferOfTheDay(nowMs = Date.now()): StoreOffer {
  const rotating = STORE_OFFERS.filter(offer => !offer.oneTime || offer.id === 'premium_pass' || offer.id === 'no_ads');
  const daySeed = Math.floor(nowMs / (24 * 60 * 60 * 1000));
  return rotating[daySeed % rotating.length];
}

export function purchaseStoreOffer(state: GameState, offerId: string, nowMs = Date.now()): boolean {
  if (!canPurchaseStoreOffer(state, offerId)) return false;
  const offer = STORE_OFFERS.find(item => item.id === offerId);
  if (!offer) return false;

  state.playerGems += offer.gems;
  state.playerGold += offer.gold;
  state.lifetimeSpendUsd += offer.usdPrice;

  if (offer.premiumPass) state.premiumPass = true;
  if (offer.adFree) state.adFree = true;
  if (offer.oneTime) state.purchasedOffers.push(offer.id);

  const offerOfDay = getOfferOfTheDay(nowMs);
  const dayKey = getOfferDayKey(nowMs);
  const offerToken = `offer_day_${dayKey}_${offer.id}`;
  if (offer.id === offerOfDay.id && !state.purchasedOffers.includes(offerToken)) {
    state.playerGems += Math.floor(offer.gems * 0.2);
    state.playerGold += Math.floor(offer.gold * 0.25) + 80;
    state.purchasedOffers.push(offerToken);
  }

  return true;
}
