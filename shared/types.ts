export type AssetKey = 'mountain' | 'signpost' | 'hiker' | 'profile' | 'scobe' | 'mark';

export interface CategoryRatings {
  beauty: number;
  privacy: number;
  accessibility: number;
}

export interface Ratings extends CategoryRatings {
  overall: number;
}

export interface Spot {
  id: string;
  ownerId?: string;
  name: string;
  locality: string;
  description: string;
  latitude: number;
  longitude: number;
  /** A bundled AssetKey or a validated JPEG/PNG/WebP data URI. */
  photos: string[];
  ratings: Ratings;
  reviewCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Review {
  id: string;
  authorId?: string;
  author: { name: string; avatar: string | null };
  text: string;
  ratings: CategoryRatings;
  createdAt: string;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  level: number;
  xp: number;
  preferences: Preferences;
}

export interface Preferences {
  distanceUnit: 'km' | 'mi';
  defaultView: 'map' | 'list';
  reduceMotion: boolean;
}
export interface AccountData {
  profile: Profile;
  savedSpotIds: string[];
  contributions: { spots: Spot[]; reviews: (Review & { spotId: string; spotName: string })[] };
}

export interface AuthResponse { profile: Profile; token: string }

export interface CreateReviewInput {
  text: string;
  ratings: CategoryRatings;
}

export interface CreateSpotInput {
  name: string;
  locality: string;
  description: string;
  latitude: number;
  longitude: number;
  photos: string[];
  ratings: CategoryRatings;
}

export interface ApiError {
  error: { code: string; message: string; field?: string };
}
