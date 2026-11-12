import { notFound } from "next/navigation";
import {
  getEducationForAdmin,
  getExperienceForAdmin,
  getProfileForAdmin,
  getSkillsForAdmin,
  getSocialLinksForAdmin,
} from "@/server/queries/profile";
import { getMediaLibrary } from "@/server/queries/media-library";
import { toMediaView } from "@/server/queries/media";
import { PageHeader } from "@/components/admin/page-header";
import { Flash } from "@/components/admin/flash";
import { ProfileForm, emptyProfile, type ProfileFormInitial } from "@/components/admin/profile-form";
import {
  EducationSection,
  ExperienceSection,
  SkillsSection,
  SocialSection,
} from "@/components/admin/profile-sections";

export default async function ProfileAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    editEducation?: string;
    editExperience?: string;
    editSkill?: string;
    editSocial?: string;
  }>;
}) {
  const query = await searchParams;
  const [profile, education, experience, skills, socials, library] = await Promise.all([
    getProfileForAdmin(),
    getEducationForAdmin(),
    getExperienceForAdmin(),
    getSkillsForAdmin(),
    getSocialLinksForAdmin(),
    getMediaLibrary(),
  ]);

  const vi = profile?.translations.find((item) => item.locale === "vi");
  const en = profile?.translations.find((item) => item.locale === "en");

  const initial: ProfileFormInitial = profile
    ? {
        email: profile.email,
        phone: profile.phone ?? "",
        location: profile.location ?? "",
        resumeUrl: profile.resumeUrl ?? "",
        availableForWork: profile.availableForWork,
        avatar: toMediaView(profile.avatarMedia),
        vi: {
          fullName: vi?.fullName ?? "",
          title: vi?.title ?? "",
          shortBio: vi?.shortBio ?? "",
          longBio: vi?.longBio ?? "",
          interests: vi?.interests ?? "",
          philosophy: vi?.philosophy ?? "",
          futureGoals: vi?.futureGoals ?? "",
          seoTitle: vi?.seoTitle ?? "",
          seoDescription: vi?.seoDescription ?? "",
        },
        en: {
          fullName: en?.fullName ?? "",
          title: en?.title ?? "",
          shortBio: en?.shortBio ?? "",
          longBio: en?.longBio ?? "",
          interests: en?.interests ?? "",
          philosophy: en?.philosophy ?? "",
          futureGoals: en?.futureGoals ?? "",
          seoTitle: en?.seoTitle ?? "",
          seoDescription: en?.seoDescription ?? "",
        },
      }
    : emptyProfile;

  const editEducationRow = query.editEducation
    ? education.find((row) => row.id === query.editEducation)
    : null;
  const editExperienceRow = query.editExperience
    ? experience.find((row) => row.id === query.editExperience)
    : null;
  const editSkillRow = query.editSkill ? skills.find((row) => row.id === query.editSkill) : null;
  const editSocialRow = query.editSocial ? socials.find((row) => row.id === query.editSocial) : null;

  if (
    (query.editEducation && !editEducationRow) ||
    (query.editExperience && !editExperienceRow) ||
    (query.editSkill && !editSkillRow) ||
    (query.editSocial && !editSocialRow)
  ) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Hồ sơ cá nhân"
        description="Toàn bộ nội dung trang chủ và trang Giới thiệu được lấy từ đây. Không có thông tin cá nhân nào bị hardcode trong giao diện."
      />

      {query.saved && <Flash message="Đã lưu hồ sơ." />}

      <div className="space-y-6">
        <ProfileForm initial={initial} library={library} />
        <EducationSection rows={education} editing={editEducationRow} />
        <ExperienceSection rows={experience} editing={editExperienceRow} />
        <SkillsSection rows={skills} editing={editSkillRow} />
        <SocialSection rows={socials} editing={editSocialRow} />
      </div>
    </>
  );
}
