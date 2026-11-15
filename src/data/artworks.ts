export {
  listArtworks,
  countArtworks,
  listArtworkSlugs,
  listCollections,
  getCollection,
  getArtworkDetail,
  getArtworkCategories,
  incrementArtworkView,
  toCardMediaView,
} from "@/server/queries/artworks";

export type {
  ArtworkCardData,
  ArtworkDetailData,
  ArtworkFilters,
  CardMediaView,
  CollectionData,
} from "@/server/queries/artworks";
