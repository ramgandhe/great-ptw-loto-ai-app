/** Empty list means the hazard is offered on every permit type. */
export function hazardFitsPermitType(
  permitTypeCodes: readonly string[] | null | undefined,
  permitTypeCode: string | null | undefined,
): boolean {
  if (!permitTypeCodes?.length) {
    return true;
  }
  if (!permitTypeCode) {
    return true;
  }
  return permitTypeCodes.includes(permitTypeCode);
}
