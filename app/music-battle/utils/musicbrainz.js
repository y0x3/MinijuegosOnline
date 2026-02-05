import { calculateSimilarity } from './textUtils';

/**
 * Busca artistas en la API de MusicBrainz
 */
export const searchArtist = async (query) => {
  if (query.length < 2) return [];
  
  try {
    const response = await fetch(
      `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(query)}&fmt=json&limit=10`,
      { headers: { 'User-Agent': 'MusicBattleGame/2.0' } }
    );

    if (!response.ok) return [];
    const data = await response.json();
    if (!data.artists) return [];
    
    const results = data.artists.map(artist => ({
      ...artist,
      similarity: calculateSimilarity(query, artist.name)
    }));
    
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, 5);
  } catch (error) {
    console.error('Error searching artist:', error);
    return [];
  }
};

/**
 * Obtiene información detallada de un artista
 */
export const getArtistInfo = async (artistName) => {
  try {
    const results = await searchArtist(artistName);
    if (results.length === 0) return null;

    const artist = results[0];
    const detailsResponse = await fetch(
      `https://musicbrainz.org/ws/2/artist/${artist.id}?inc=tags+genres+annotation&fmt=json`,
      { headers: { 'User-Agent': 'MusicBattleGame/2.0' } }
    );

    if (!detailsResponse.ok) return null;
    const details = await detailsResponse.json();
    
    // Intentar obtener imagen del Cover Art Archive
    let imageUrl = null;
    try {
      const releasesResponse = await fetch(
        `https://musicbrainz.org/ws/2/release?artist=${artist.id}&fmt=json&limit=1`,
        { headers: { 'User-Agent': 'MusicBattleGame/2.0' } }
      );
      
      if (releasesResponse.ok) {
        const releasesData = await releasesResponse.json();
        if (releasesData.releases && releasesData.releases.length > 0) {
          const releaseId = releasesData.releases[0].id;
          const coverResponse = await fetch(
            `https://coverartarchive.org/release/${releaseId}`,
            { method: 'GET' }
          );
          
          if (coverResponse.ok) {
            const coverData = await coverResponse.json();
            if (coverData.images && coverData.images.length > 0) {
              imageUrl = coverData.images[0].thumbnails?.small || coverData.images[0].image;
            }
          }
        }
      }
    } catch (error) {
      console.log('No se pudo obtener imagen:', error);
    }

    return {
      name: details.name,
      country: details.country || 'Desconocido',
      type: details.type === 'Group' ? 'Banda' : 'Solista',
      beginYear: details['life-span']?.begin?.split('-')[0] || '?',
      endYear: details['life-span']?.end?.split('-')[0] || 'Activo',
      genres: [...(details.tags || []).map(t => t.name), ...(details.genres || []).map(g => g.name)]
        .slice(0, 5)
        .join(', ') || 'No especificado',
      image: imageUrl
    };
  } catch (error) {
    console.error('Error getting artist info:', error);
    return null;
  }
};