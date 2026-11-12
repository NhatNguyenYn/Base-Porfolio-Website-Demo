/**
 * Profile data seam.
 *
 * The public UI only talks to this module. Today it reads the seeded database
 * through the query layer; in a later phase the implementation can be swapped
 * for a remote API without touching a single component.
 */
export {
  getProfile,
  profileContent,
  getEducation,
  getExperience,
  getSkills,
  getSocialLinks,
} from "@/server/queries/profile";

export type {
  ProfileView,
  ProfileContent,
  ProfileTranslationView,
  EducationView,
  ExperienceView,
  SkillView,
  SocialLinkView,
} from "@/server/queries/profile";
