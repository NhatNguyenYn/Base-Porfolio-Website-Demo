export {
  listArtworks,
  listCollections,
  getCollection,
  getArtworkDetail,
  getArtworkCategories,
  incrementArtworkView,
} from "@/server/queries/artworks";

export type {
  ArtworkCardData,
  ArtworkDetailData,
  ArtworkFilters,
  CollectionData,
} from "@/server/queries/artworks";
