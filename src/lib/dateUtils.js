import { differenceInDays, parseISO, isValid } from 'date-fns';

export function calculateAge(dateOfDeath, datePaidInFull) {
  if (!dateOfDeath) return null;

  const deathDate = typeof dateOfDeath === 'string' ? parseISO(dateOfDeath) : dateOfDeath;
  if (!isValid(deathDate)) return null;

  let endDate;
  if (datePaidInFull) {
    endDate = typeof datePaidInFull === 'string' ? parseISO(datePaidInFull) : datePaidInFull;
    if (!isValid(endDate)) {
      endDate = new Date();
    }
  } else {
    endDate = new Date();
  }

  const days = differenceInDays(endDate, deathDate);
  return days >= 0 ? days : 0;
}

export function calculateAverageAge(cases) {
  if (!cases || cases.length === 0) return 0;

  const ages = cases
    .map(c => calculateAge(c.date_of_death, c.date_paid_in_full))
    .filter(age => age !== null);

  if (ages.length === 0) return 0;
  return ages.reduce((sum, age) => sum + age, 0) / ages.length;
}

export function formatAge(age) {
  if (age === null || age === undefined) return '-';
  return Math.round(age).toString();
}

export function getDefaultDateRange() {
  const today = new Date();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(today.getMonth() - 12);

  return {
    startDate: twelveMonthsAgo.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0]
  };
}
