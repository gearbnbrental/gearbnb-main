/**
 * The Find A Campsite directory, exactly as the RMS customer API returns it
 * (GET /api/customer/campsites and /api/customer/campsites/[slug]). GearBnB staff curate every
 * campsite in the RMS; this site only reads them and lets signed-in campers review them.
 *
 * Every detail is optional (null) on purpose: a blank answer shows as "not confirmed yet", never
 * as a guess. Terrain, ground and activities are plain display labels ("Riverside", "Stargazing")
 * so staff can add new options in the RMS without either codebase changing.
 */

export type SignalLevel = 'NONE' | 'WEAK' | 'STRONG';
export type DrinkingWater = 'POTABLE' | 'WASH_ONLY' | 'NONE';
export type Electricity = 'AVAILABLE' | 'LIMITED' | 'NONE';
export type Parking = 'AT_CAMPSITE' | 'PARK_AND_WALK' | 'NONE';
export type RoadAccess = 'ANY_CAR' | 'SUV_4X4' | 'HIKE_IN';
export type PetPolicy = 'ALLOWED' | 'NOT_ALLOWED' | 'ASK';
export type Campfire = 'ALLOWED' | 'PIT_ONLY' | 'NOT_ALLOWED';
export type Shade = 'LOTS' | 'SOME' | 'NONE';
export type StoreNearby = 'NONE' | 'SARI_SARI' | 'MARKET_OR_TOWN';
export type FeeUnit = 'PER_PERSON' | 'PER_TENT' | 'PER_NIGHT' | 'PER_GROUP';
export type BookingMethod = 'FACEBOOK' | 'PHONE' | 'SMS' | 'WEBSITE' | 'WALK_IN' | 'OTHER';

export interface CampsiteDetails {
  /** Smart, and TNT on the same network. */
  signalSmart: SignalLevel | null;
  /** Globe, and TM and GOMO on the same network. */
  signalGlobe: SignalLevel | null;
  signalDito: SignalLevel | null;
  hasRestroom: boolean | null;
  hasShowers: boolean | null;
  drinkingWater: DrinkingWater | null;
  electricity: Electricity | null;
  parking: Parking | null;
  /** Only with parking PARK_AND_WALK: the walk from the parking to the campsite. */
  parkingWalkMinutes: number | null;
  roadAccess: RoadAccess | null;
  /** Car camping: you can park right beside your tent. */
  carCamping: boolean | null;
  /** Motocamping: motorcycles can ride in and park at the camping area. */
  motoCamping: boolean | null;
  petPolicy: PetPolicy | null;
  campfire: Campfire | null;
  cookingAllowed: boolean | null;
  shade: Shade | null;
  kidFriendly: boolean | null;
  tentsOnSite: boolean | null;
  storeNearby: StoreNearby | null;
  terrain: string[];
  groundTypes: string[];
  activities: string[];
  houseRules: string | null;
  bestTimeToVisit: string | null;
}

export interface CampsitePhoto {
  url: string;
  alt: string;
  /** "Photo: …" credit, when the photo isn't GearBnB's own. */
  credit: string | null;
}

/** A photo a camper attached to their review, shown in the campsite's gallery under "From campers". */
export interface CamperPhoto {
  url: string;
  /** Their caption, if they wrote one; otherwise empty. */
  alt: string;
  /** Its storage path: only on the camper's own review (my-review), so they can keep it when editing. */
  path?: string;
}

export interface CampsiteRating {
  /** One decimal place; null with no published reviews. */
  average: number | null;
  count: number;
}

/** One campsite in the directory list: everything the cards, filters, map and schema need. */
export interface CampsiteSummary {
  slug: string;
  name: string;
  region: string;
  province: string;
  cityMunicipality: string;
  lat: number;
  lng: number;
  coverPhoto: CampsitePhoto | null;
  entranceFeeCentavos: number | null;
  campingFeeCentavos: number | null;
  feeUnit: FeeUnit | null;
  driveMinutesFromLasPinas: number | null;
  details: CampsiteDetails;
  rating: CampsiteRating;
  /** ISO date (yyyy-mm-dd) GearBnB last confirmed the details. */
  detailsCheckedAt: string | null;
  /** What the campsite gives campers who come from GearBnB and mention their code, in the
   *  campsite's own words ("10% off the entrance fee"); null when it has no offer. */
  gearbnbOffer: string | null;
  /** ISO timestamp of the last change to the campsite or its reviews. */
  updatedAt: string;
}

export interface CampsiteReview {
  id: string;
  /** First name and last initial, e.g. "Maria S."; never an email or full name. */
  displayName: string;
  rating: number;
  body: string;
  /** ISO date (yyyy-mm-dd). */
  visitDate: string | null;
  createdAt: string;
  updatedAt: string;
  /** The reviewer has a completed GearBnB rental. */
  isRenter: boolean;
  /** Up to 5 photos from the camper's visit. */
  photos: CamperPhoto[];
}

export type RatingBreakdown = Record<'1' | '2' | '3' | '4' | '5', number>;

export interface Campsite extends CampsiteSummary {
  description: string;
  barangay: string | null;
  addressLine: string | null;
  googleMapsUrl: string | null;
  phone: string | null;
  facebookUrl: string | null;
  websiteUrl: string | null;
  bookingMethod: BookingMethod | null;
  bookingNotes: string | null;
  feeNotes: string | null;
  operatingHours: string | null;
  /** The offer's conditions ("Weekdays only. Not with other promos."); null when none. */
  gearbnbOfferTerms: string | null;
  photos: CampsitePhoto[];
  ratingBreakdown: RatingBreakdown;
  /** Published reviews, newest first (at most 50). */
  reviews: CampsiteReview[];
}

export type ReviewBlockReason = 'ACCOUNT_TOO_NEW' | 'DAILY_LIMIT';

export interface MyCampsiteReview {
  review: CampsiteReview | null;
  /** False when the account can't post a new review right now; editing an existing one is always allowed. */
  canReview: boolean;
  reason: ReviewBlockReason | null;
}

export interface CampsiteReviewInput {
  rating: number;
  body: string;
  visitDate: string | null;
  /** Storage paths (in the campsite-review-photos bucket, under the camper's own folder) of the
   *  photos to keep on the review, in order. Sending the list replaces the review's photos. */
  photoPaths: string[];
}

export type ReviewReportReason = 'SPAM' | 'OFFENSIVE' | 'FAKE' | 'PRIVATE_INFO' | 'OTHER';

/** Which contact button the camper tapped on a campsite's page. */
export type CampsiteLeadChannel = 'FACEBOOK' | 'PHONE' | 'SMS' | 'WEBSITE';

/** POST /api/customer/campsites/[slug]/leads: one tap on a contact button. Nothing about the
 *  camper is sent or stored. */
export interface CampsiteLeadInput {
  channel: CampsiteLeadChannel;
}

/** The lead's code ("GB-7K3QXM"): the camper is asked to mention it, and the campsite's lead email
 *  gets the same code, so the campsite knows the camper came from GearBnB. */
export interface CampsiteLeadResult {
  code: string;
}
