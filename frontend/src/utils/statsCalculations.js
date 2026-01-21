/**
 * Calculate statistics from photos data
 */

export function calculateStats(stats, photos, persons) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Find today's stats from the statistics API
  const todayDate = today.toISOString().split('T')[0];
  const todayStats = stats.find(s => s.date === todayDate);

  // Find this week's stats (last 7 days)
  const weekStats = stats.filter(s => {
    const statDate = new Date(s.date);
    return statDate >= weekAgo && statDate <= today;
  });

  const photosToday = todayStats ? todayStats.photos_uploaded : 0;
  const photosThisWeek = weekStats.reduce((sum, s) => sum + s.photos_uploaded, 0);
  const facesThisWeek = weekStats.reduce((sum, s) => sum + s.faces_detected, 0);

  return {
    totalPhotos: photos.length,
    totalPersons: persons.length,
    photosToday,
    photosThisWeek,
    facesThisWeek,
    facesToday: todayStats ? todayStats.faces_detected : 0
  };
}

/**
 * Prepare chart data from daily statistics
 * Returns last 7 days of data for charting
 */
export function getLast7DaysChartData(stats) {
  // Get last 7 days
  const today = new Date();
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    // Find stats for this date
    const dayStat = stats.find(s => s.date === dateStr);

    days.push({
      date: dateStr,
      dateFormatted: formatDateShort(date),
      photos: dayStat ? dayStat.photos_uploaded : 0,
      faces: dayStat ? dayStat.faces_detected : 0
    });
  }

  return days;
}

/**
 * Format date as "Mon 20" or "Jan 20"
 */
function formatDateShort(date) {
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}
