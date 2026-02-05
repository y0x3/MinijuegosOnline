// app/music-battle/utils/roomCleanup.js
// Este archivo se encarga de limpiar salas automáticamente

import { ref, get, remove } from 'firebase/database';

/**
 * FUNCIÓN 1: Limpia salas inactivas y mantiene el límite máximo
 * 
 * Esta función hace 2 cosas:
 * 1. Elimina salas que llevan más de X minutos sin actividad
 * 2. Si hay más de 20 salas, elimina las más antiguas
 */
export const cleanupRooms = async (database, inactivityMinutes = 10, maxRooms = 20) => {
  if (!database) return;

  try {
    // Obtener todas las salas de Firebase
    const roomsRef = ref(database, 'rooms');
    const snapshot = await get(roomsRef);

    if (!snapshot.exists()) return; // Si no hay salas, no hacer nada

    const rooms = snapshot.val();
    const now = Date.now(); // Tiempo actual en milisegundos
    const inactivityThreshold = inactivityMinutes * 60 * 1000; // Convertir minutos a milisegundos
    
    // Convertir objeto de salas a array para poder trabajar con él
    const roomsArray = Object.keys(rooms).map(code => ({
      code,
      ...rooms[code]
    }));

    // ========================================
    // PASO 1: ELIMINAR SALAS INACTIVAS
    // ========================================
    const inactiveRooms = roomsArray.filter(room => {
      const lastActivity = room.lastActivity || room.createdAt || 0;
      const inactiveTime = now - lastActivity; // Cuánto tiempo sin actividad
      return inactiveTime > inactivityThreshold; // Si excede el límite, marcar para eliminar
    });

    // Eliminar cada sala inactiva
    for (const room of inactiveRooms) {
      await remove(ref(database, `rooms/${room.code}`));
      const minutesInactive = Math.floor((now - (room.lastActivity || room.createdAt)) / 60000);
      console.log(`🗑️ Sala ${room.code} eliminada por inactividad (${minutesInactive} minutos)`);
    }

    // ========================================
    // PASO 2: VERIFICAR LÍMITE MÁXIMO DE SALAS
    // ========================================
    // Obtener salas que quedan después de eliminar las inactivas
    const remainingRooms = roomsArray.filter(room => 
      !inactiveRooms.find(ir => ir.code === room.code)
    );

    if (remainingRooms.length > maxRooms) {
      // Si hay más de 20 salas, eliminar las más antiguas
      
      // Ordenar por antigüedad (las más viejas primero)
      remainingRooms.sort((a, b) => {
        const aTime = a.lastActivity || a.createdAt || 0;
        const bTime = b.lastActivity || b.createdAt || 0;
        return aTime - bTime; // Orden ascendente (antiguas primero)
      });

      // Calcular cuántas salas eliminar
      const roomsToDelete = remainingRooms.slice(0, remainingRooms.length - maxRooms);
      
      // Eliminar las salas más antiguas
      for (const room of roomsToDelete) {
        await remove(ref(database, `rooms/${room.code}`));
        console.log(`🗑️ Sala ${room.code} eliminada por exceder límite máximo`);
      }
    }

    // Mostrar resumen de limpieza
    const totalDeleted = inactiveRooms.length + (remainingRooms.length > maxRooms ? remainingRooms.length - maxRooms : 0);
    if (totalDeleted > 0) {
      console.log(`✅ Limpieza completada. Salas eliminadas: ${totalDeleted}`);
    }
    
  } catch (error) {
    console.error('❌ Error en limpieza de salas:', error);
  }
};

/**
 * FUNCIÓN 2: Inicia limpieza automática cada X minutos
 * 
 * Esta función ejecuta cleanupRooms automáticamente cada cierto tiempo
 * Parámetros:
 * - intervalMinutes: cada cuántos minutos limpiar (default: 5)
 * - inactivityMinutes: minutos sin actividad para eliminar sala (default: 10)
 * - maxRooms: número máximo de salas permitidas (default: 20)
 */
export const startRoomCleanupInterval = (database, intervalMinutes = 5, inactivityMinutes = 10, maxRooms = 20) => {
  if (!database) return null;

  // Ejecutar limpieza inmediatamente al iniciar
  cleanupRooms(database, inactivityMinutes, maxRooms);

  // Programar limpieza automática cada X minutos
  const interval = setInterval(() => {
    cleanupRooms(database, inactivityMinutes, maxRooms);
  }, intervalMinutes * 60 * 1000); // Convertir minutos a milisegundos

  console.log(`🔄 Sistema de limpieza automática iniciado:`);
  console.log(`   - Se ejecuta cada ${intervalMinutes} minutos`);
  console.log(`   - Elimina salas inactivas por ${inactivityMinutes} minutos`);
  console.log(`   - Máximo de salas: ${maxRooms}`);
  
  return interval; // Devolver el interval para poder cancelarlo después
};