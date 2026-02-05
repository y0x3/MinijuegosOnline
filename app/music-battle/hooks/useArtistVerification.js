import { useState } from 'react';
import { searchArtist } from '../utils/musicbrainz';
import { normalizeText } from '../utils/textUtils';
import { genres } from '../constants/genres';

export const useArtistVerification = (genre, usedArtists, artistType = 'both') => {
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyArtist = async (artistName) => {
    try {
      setIsVerifying(true);

      const results = await searchArtist(artistName);
      
      if (results.length === 0) {
        return { valid: false, reason: 'Artista no encontrado' };
      }

      const bestMatch = results[0];
      
      if (bestMatch.similarity < 0.7) {
        return { 
          valid: false, 
          reason: `No encontrado. ¿Quisiste decir "${bestMatch.name}"?` 
        };
      }

      const normalizedName = normalizeText(bestMatch.name);
      const alreadyUsed = usedArtists.some(used => 
        normalizeText(used) === normalizedName
      );
      
      if (alreadyUsed) {
        return { valid: false, reason: `${bestMatch.name} ya fue usado` };
      }

      // ⭐ NUEVO: Verificar tipo de artista (solista vs banda)
      if (artistType !== 'both') {
        const artistInfoResponse = await fetch(
          `https://musicbrainz.org/ws/2/artist/${bestMatch.id}?fmt=json`,
          { headers: { 'User-Agent': 'MusicBattleGame/2.0' } }
        );

        if (artistInfoResponse.ok) {
          const artistInfo = await artistInfoResponse.json();
          const artistTypeFromAPI = artistInfo.type || '';
          
          // Tipos de MusicBrainz: "Person" = solista, "Group" = banda
          const isSoloArtist = artistTypeFromAPI === 'Person';
          const isBand = artistTypeFromAPI === 'Group';

          if (artistType === 'solo' && !isSoloArtist) {
            return { 
              valid: false, 
              reason: `${bestMatch.name} no es un artista solista` 
            };
          }

          if (artistType === 'bands' && !isBand) {
            return { 
              valid: false, 
              reason: `${bestMatch.name} no es una banda/grupo` 
            };
          }
        }
      }

      const tagsResponse = await fetch(
        `https://musicbrainz.org/ws/2/artist/${bestMatch.id}?inc=tags+genres&fmt=json`,
        { headers: { 'User-Agent': 'MusicBattleGame/2.0' } }
      );

      if (!tagsResponse.ok) {
        return { valid: true, artistName: bestMatch.name, warning: 'Género no verificado' };
      }

      const tagsData = await tagsResponse.json();
      const artistTags = [
        ...(tagsData.tags || []).map(t => t.name.toLowerCase()),
        ...(tagsData.genres || []).map(g => g.name.toLowerCase())
      ];

      const genreTags = genres[genre].tags;
      const hasGenre = artistTags.some(tag => 
        genreTags.some(genreTag => 
          tag.includes(genreTag) || genreTag.includes(tag)
        )
      );

      if (!hasGenre && artistTags.length > 0) {
        return { 
          valid: false, 
          reason: `${bestMatch.name} no es ${genres[genre].name}` 
        };
      }

      return { valid: true, artistName: bestMatch.name };

    } catch (error) {
      console.error('Error verifying artist:', error);
      return { valid: false, reason: 'Error de conexión' };
    } finally {
      setIsVerifying(false);
    }
  };

  return { verifyArtist, isVerifying };
};