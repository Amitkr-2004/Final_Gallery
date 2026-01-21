import React, { createContext, useState, useEffect } from 'react';

export const EventContext = createContext();

export const EventProvider = ({ children }) => {
  const [events, setEvents] = useState(() => {
    const savedEvents = localStorage.getItem('gallery-events');
    return savedEvents ? JSON.parse(savedEvents) : [];
  });

  const [activeEvent, setActiveEvent] = useState(null);

  // Photo-Event mapping: { eventId: [photoId1, photoId2, ...] }
  const [eventPhotos, setEventPhotos] = useState(() => {
    const savedMapping = localStorage.getItem('gallery-event-photos');
    return savedMapping ? JSON.parse(savedMapping) : {};
  });

  useEffect(() => {
    localStorage.setItem('gallery-events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('gallery-event-photos', JSON.stringify(eventPhotos));
  }, [eventPhotos]);

  const createEvent = (eventData) => {
    const newEvent = {
      id: `evt_${Date.now()}`,
      ...eventData,
      createdAt: new Date().toISOString(),
      imageCount: 0,
    };
    setEvents([...events, newEvent]);
    return newEvent;
  };

  const updateEvent = (eventId, updates) => {
    setEvents(events.map(e => e.id === eventId ? { ...e, ...updates } : e));
  };

  const deleteEvent = (eventId) => {
    setEvents(events.filter(e => e.id !== eventId));
    if (activeEvent?.id === eventId) {
      setActiveEvent(null);
    }
  };

  const getEvent = (eventId) => {
    return events.find(e => e.id === eventId);
  };

  const addPhotoToEvent = (eventId, photoId) => {
    setEventPhotos(prev => {
      const eventPhotoList = prev[eventId] || [];
      // Avoid duplicates
      if (eventPhotoList.includes(photoId)) {
        return prev;
      }
      return {
        ...prev,
        [eventId]: [...eventPhotoList, photoId]
      };
    });
  };

  const getEventPhotoCount = (eventId) => {
    return (eventPhotos[eventId] || []).length;
  };

  const removePhotoFromEvent = (eventId, photoId) => {
    setEventPhotos(prev => {
      const eventPhotoList = prev[eventId] || [];
      return {
        ...prev,
        [eventId]: eventPhotoList.filter(id => id !== photoId)
      };
    });
  };

  return (
    <EventContext.Provider value={{
      events,
      activeEvent,
      setActiveEvent,
      createEvent,
      updateEvent,
      deleteEvent,
      getEvent,
      addPhotoToEvent,
      getEventPhotoCount,
      removePhotoFromEvent,
      eventPhotos,
    }}>
      {children}
    </EventContext.Provider>
  );
};
