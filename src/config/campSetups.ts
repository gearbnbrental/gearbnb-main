export type CampSetupCategory = 'glamping' | 'solo' | 'group';

export interface CampSetupPhoto {
  id: string;
  /** Path under public/, e.g. '/images/camp-setups/photo-1.jpg'. */
  src: string;
  /** Short setup title shown as a caption under the thumbnail. */
  title: string;
  alt: string;
  /** Small top-left pill on the thumbnail — the tent brand where one is actually visible/legible
   *  in the photo (matches what's already committed to in that photo's own alt text above), or a
   *  generic descriptor otherwise. Never a specific product/model name that isn't visible. */
  badge: string;
  /** Drives the gallery's filter tabs ("Solo & Couple" / "Group & Family" / "Glamping"). A
   *  best-effort read of what each photo actually shows (chair count, tent size, how furnished
   *  the setup looks) — there is no real category metadata from the client to draw on, so this is
   *  presentation-only grouping, not a claim about how GearBnB itself classifies these setups.
   *  Only one photo (the cabin-style tent with a full furnished spread) reads as "glamping" over
   *  plain "group" camping; that filter will show just the one result until more photos exist. */
  category: CampSetupCategory;
  /** What's visibly present in the shot, in plain gear-category terms (never a specific product/
   *  model name, never a price, never framed as an official bookable bundle) — shown in the
   *  lightbox as "What's Shown" so the detail view has more than just a title, without claiming
   *  more certainty than a photo can actually support. */
  visibleGear: string[];
}

/**
 * "View Our Camp Setups" gallery source images — the client's actual photos.
 *
 * The 8 files the client supplied (via Google Drive, then placed directly into
 * `public/images/camp-setups/`) were each ~9449x11811px and 120-265MB — far too large to serve on
 * a web page (a single one of these would take minutes to download on a typical connection, and
 * decoding an 111-megapixel image can crash a mobile browser tab). That squarely met this task's
 * own "unless absolutely necessary for display" exception for altering the photos, so each was
 * resized (long edge capped at 1920px, preserving aspect ratio and content — no cropping, no
 * edits) and re-saved as a JPEG here, landing between ~530KB-1.1MB. The original, untouched files
 * were moved to `camp-setups-originals/` at the repo root (outside `public/`, so they're preserved
 * on disk but never copied into a production build) rather than deleted.
 *
 * Titles/alt text below describe what's actually visible in each photo (tent brand/style, setup,
 * setting) — there was no other caption metadata to go on, since the source filenames were just
 * "3.png".."8.png" plus two more descriptively named ones.
 */
export const CAMP_SETUP_PHOTOS: CampSetupPhoto[] = [
  {
    id: 'camp-setup-1',
    src: '/images/camp-setups/camp-setup-1.jpg',
    title: 'Black Dog Tent with Canopy',
    alt: 'Black Dog tent with its canopy extended over a seating and table area, set up in a grassy clearing',
    badge: 'Black Dog',
    category: 'group',
    visibleGear: ['Tent with canopy', 'Folding chairs', 'Folding table'],
  },
  {
    id: 'camp-setup-2',
    src: '/images/camp-setups/camp-setup-2.jpg',
    title: 'Shaded Tent Setup',
    alt: 'Naturehike-style tent pitched in the shade of large trees, with folding chairs and a cooler set up alongside',
    badge: 'Naturehike',
    category: 'group',
    visibleGear: ['Tent', 'Folding chairs', 'Cooler'],
  },
  {
    id: 'camp-setup-3',
    src: '/images/camp-setups/camp-setup-3.jpg',
    title: 'Forest Camp in the Pines',
    alt: 'Small tarp shelter pitched on a misty, pine-forested hillside',
    badge: 'Ultralight Setup',
    category: 'solo',
    visibleGear: ['Tarp shelter'],
  },
  {
    id: 'camp-setup-4',
    src: '/images/camp-setups/camp-setup-4.jpg',
    title: 'Black Dog Tent Setup',
    alt: 'Black Dog tent on a grassy site with camping chairs and gear boxes in front',
    badge: 'Black Dog',
    category: 'group',
    visibleGear: ['Tent', 'Folding chairs', 'Storage boxes'],
  },
  {
    id: 'camp-setup-5',
    src: '/images/camp-setups/camp-setup-5.jpg',
    title: 'Black Dog Tent with Cooking Setup',
    alt: 'Black Dog tent with its door open, camping chairs and a cooking setup arranged outside under palm trees',
    badge: 'Black Dog',
    category: 'group',
    visibleGear: ['Tent', 'Folding chairs', 'Portable stove', 'Cooking set'],
  },
  {
    id: 'camp-setup-6',
    src: '/images/camp-setups/camp-setup-6.jpg',
    title: 'Cozy Solo Camp Setup',
    alt: 'Small dome tent with a folding table, chairs, and a fan, set up in front of a banana plantation',
    badge: 'Solo/Couple',
    category: 'solo',
    visibleGear: ['Dome tent', 'Folding table', 'Folding chairs', 'Portable fan'],
  },
  {
    id: 'byo-camp-setup',
    src: '/images/camp-setups/byo-camp-setup.jpg',
    title: 'Build Your Own Kit',
    alt: 'A Build Your Own setup: tent awning with a row of folding chairs, a cooler, fans, and cooking gear arranged underneath',
    badge: 'Build Your Own',
    category: 'group',
    visibleGear: ['Tent awning', 'Folding chairs', 'Cooler', 'Portable fans', 'Cooking set'],
  },
  {
    id: 'choose-package-camp-setup',
    src: '/images/camp-setups/choose-package-camp-setup.jpg',
    title: 'Choose a Package',
    alt: 'A cabin-style tent with a canopy awning, folding chairs, a cooler, and a cooking setup, shaded by large trees',
    badge: 'Glamping',
    category: 'glamping',
    visibleGear: ['Cabin-style tent', 'Canopy awning', 'Folding chairs', 'Cooler', 'Cooking set'],
  },
];
