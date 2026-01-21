import React, { createContext, useState, useEffect } from 'react';

export const EventContext = createContext();

export const EventProvider = ({ children }) => {
  const [events, setEvents] = useState(() => {
    const savedEvents = localStorage.getItem('gallery-events');
    return savedEvents ? JSON.parse(savedEvents) : [];
  });

  const [activeEvent, setActiveEvent] = useState(null);

  useEffect(() => {
    localStorage.setItem('gallery-events', JSON.stringify(events));
  }, [events]);

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

  return (
    <EventContext.Provider value={{
      events,
      activeEvent,
      setActiveEvent,
      createEvent,
      updateEvent,
      deleteEvent,
      getEvent,
    }}>
      {children}
    </EventContext.Provider>
  );
};
