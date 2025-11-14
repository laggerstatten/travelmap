///////////////////////////////////////////////////////////////
// OPERATOR OPTIONS
///////////////////////////////////////////////////////////////

const operatorOptions = {
  timeComparison: [
    { value: '<', label: 'Before' },
    { value: '>', label: 'After' }
  ],
  durationComparison: [
    { value: '<', label: 'Less than' },
    { value: '>', label: 'Greater than' }
  ]
};

///////////////////////////////////////////////////////////////
// CONSTRAINT DEFINITIONS
///////////////////////////////////////////////////////////////

const constraintTypes = {
  visit: {
    label: 'Visit',
    modes: {
      timeRange: { 
        params: ['startTime', 'endTime']
       },
      dateTimeRange: { 
        params: ['startDateTime', 'endDateTime'] 
      },
      dateRange: { 
        params: ['ranges'] 
      }
    }
  },

  blackout: {
    label: 'Blackout dates',
    modes: {
      dates: { 
        params: ['dates']
       },
      ranges: { 
        params: ['ranges']
       }
    }
  },

  duration: {
    label: 'Duration',
    operatorCategory: 'durationComparison',
    modes: {
      range: { 
        params: ['minHours', 'maxHours'] 
      },
      compare: { 
        params: ['operator', 'hours'] 
      }
    }
  },

  arrival: {
    label: 'Arrival',
    operatorCategory: 'timeComparison',
    modes: {
      timeRange: { 
        params: ['startTime', 'endTime'] 
      },
      dateTimeRange: { 
        params: ['startDateTime', 'endDateTime']
       },
      dateRange: { 
        params: ['ranges'] 
      },
      compareTime: { 
        params: ['operator', 'time'] 
      },
      compareDateTime: { 
        params: ['operator', 'dateTime'] 
      }
    }
  },

  departure: {
    label: 'Departure',
    operatorCategory: 'timeComparison',
    modes: {
      timeRange: { 
        params: ['startTime', 'endTime'] 
      },
      dateTimeRange: { 
        params: ['startDateTime', 'endDateTime']
       },
      dateRange: { 
        params: ['ranges'] 
      },
      compareTime: { 
        params: ['operator', 'time'] 
      },
      compareDateTime: { 
        params: ['operator', 'dateTime']
       }
    }
  },

  daysOfWeek: {
    label: 'Allowed days of week',
    modes: { 
      default: { 
      params: ['days'] 
    } 
  }
  },

  holidays: {
    label: 'Holiday rules',
    modes: { 
      default: { 
      params: ['include', 'exclude'] 
    } 
  }
  },

  businessHours: {
    label: 'Business hours',
    modes: {
      default: {
        params: ['openTime', 'lastEntryTime', 'closeTime', 'daysOfWeek']
      }
    }
  },

  visitInsideBusinessHours: {
    label: 'Visit must fit inside business hours',
    modes: { 
      default: { 
      params: [] 
    } 
  }
  },

  minAfterOpen: {
    label: 'Arrive at least X minutes after opening',
    modes: { 
      minutes: { 
        params: ['minutes']
       }
       }
  },

  maxBeforeClose: {
    label: 'Depart no later than X minutes before closing',
    modes: { 
      minutes: { 
      params: ['minutes'] 
    } 
  }
  },

  avoidTimes: {
    label: 'Avoid these times',
    modes: { 
      windows: { 
        params: ['windows']
       }
       }
  },

  mustPrecede: {
    label: 'Must occur before',
    modes: { 
      default: { 
      params: ['otherSegmentId'] 
    } 
  }
  },

  mustFollow: {
    label: 'Must occur after',
    modes: { 
      default: { 
      params: ['otherSegmentId'] 
    } 
  }
  }
};
