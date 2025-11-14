const operatorOptions = {
  // arrival/departure before/after
  timeComparison: [
    { value: '<', label: 'Before' },
    { value: '>', label: 'After' }
  ],

  // duration comparisons
  durationComparison: [
    { value: '<', label: 'Less than' },
    { value: '>', label: 'Greater than' }
  ]
};

const constraintTypes = {
  visit: {
    label: 'Visit',
    modes: {
      timeRange: {
        // range between two times (no date)
        params: ['startTime', 'endTime']
      },
      dateTimeRange: {
        // range between two exact date-times
        params: ['startDateTime', 'endDateTime']
      },
      dateRange: {
        // range between two dates (no time associated) -- assume local tz
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
        // range between two times (no date)
        params: ['startTime', 'endTime']
      },
      dateTimeRange: {
        // range between two exact date-times
        params: ['startDateTime', 'endDateTime']
      },
      dateRange: {
        // range between two dates (no time associated) -- assume local tz
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
        // range between two times (no date)
        params: ['startTime', 'endTime']
      },
      dateTimeRange: {
        // range between two exact date-times
        params: ['startDateTime', 'endDateTime']
      },
      dateRange: {
        // range between two dates (no time associated) -- assume local tz
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

  // need selector
  holidays: {
    label: 'Holiday rules',
    modes: {
      default: {
        params: ['include', 'exclude']
      }
    }
  },

  // need a way to populate this with WKT
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

  blackout: {
    label: 'Blackout dates',
    modes: {
      dates: {
        // multiple days, probably non-contiguous
        params: ['dates']
      },
      ranges: {
        // range between two dates (no time associated) -- assume local tz
        params: ['ranges']
      }
    }
  },

  avoidTimes: {
    label: 'Avoid these times',
    modes: {
      // range between two times (no date) -- user needs to create more validation instances if they have more than one range
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
