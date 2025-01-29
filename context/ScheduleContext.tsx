import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Schedule } from '@/app/types/schema';

interface ScheduleContextProps {
  scheduleData: Schedule[];
  setScheduleData: React.Dispatch<React.SetStateAction<Schedule[]>>;
}

const ScheduleContext = createContext<ScheduleContextProps | undefined>(undefined);

export const ScheduleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [scheduleData, setScheduleData] = useState<Schedule[]>([]);

  return (
    <ScheduleContext.Provider value={{ scheduleData, setScheduleData }}>
      {children}
    </ScheduleContext.Provider>
  );
};

export const useSchedule = () => {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
};
