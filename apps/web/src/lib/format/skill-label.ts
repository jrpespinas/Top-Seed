export function formatSkillLabel(rating: number): string {
  if (rating <= 2) {
    return "Beginner";
  }
  if (rating <= 3.5) {
    return "Intermediate";
  }
  return "Advanced";
}
