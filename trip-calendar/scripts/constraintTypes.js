const constraintTypes = {
  "arriveBetween": {
    "label": "Arrive between",
    "modes": {
      "time": {
        "params": ["startTime", "endTime"]
      },
      "datetime": {
        "params": ["startDateTime", "endDateTime"]
      }
    }
  },

  "arriveBeforeAfter": {
    "label": "Arrive before / after",
    "modes": {
      "time": {
        "params": ["operator", "time"]
      },
      "datetime": {
        "params": ["operator", "dateTime"]
      }
    }
  },

  "departBetween": {
    "label": "Depart between",
    "modes": {
      "time": {
        "params": ["startTime", "endTime"]
      },
      "datetime": {
        "params": ["startDateTime", "endDateTime"]
      }
    }
  },

  "departBeforeAfter": {
    "label": "Depart before / after",
    "modes": {
      "time": {
        "params": ["operator", "time"]
      },
      "datetime": {
        "params": ["operator", "dateTime"]
      }
    }
  },

  "visitBetween": {
    "label": "Visit between",
    "modes": {
      "time": {
        "params": ["startTime", "endTime"]
      },
      "datetime": {
        "params": ["startDateTime", "endDateTime"]
      }
    }
  },

  "durationBetween": {
    "label": "Duration between",
    "modes": {
      "hours": {
        "params": ["minHours", "maxHours"]
      }
    }
  },

  "durationCompare": {
    "label": "Duration comparison",
    "modes": {
      "hours": {
        "params": ["operator", "hours"]
      }
    }
  },

  "minAfterOpen": {
    "label": "Arrive at least X minutes after opening",
    "modes": {
      "minutes": {
        "params": ["minutes"]
      }
    }
  },

  "maxBeforeClose": {
    "label": "Depart no later than X minutes before closing",
    "modes": {
      "minutes": {
        "params": ["minutes"]
      }
    }
  },

  "businessHours": {
    "label": "Business hours",
    "modes": {
      "default": {
        "params": ["openTime", "lastEntryTime", "closeTime", "daysOfWeek"]
      }
    }
  },

  "visitInsideBusinessHours": {
    "label": "Visit must fit inside business hours",
    "modes": {
      "default": {
        "params": []
      }
    }
  },

  "daysOfWeek": {
    "label": "Allowed days of week",
    "modes": {
      "default": {
        "params": ["days"]
      }
    }
  },

  "holidays": {
    "label": "Holiday rules",
    "modes": {
      "default": {
        "params": ["include", "exclude"]
      }
    }
  },

  "blackoutDates": {
    "label": "Blackout dates",
    "modes": {
      "list": {
        "params": ["dates"]
      }
    }
  },

  "blackoutDateRanges": {
    "label": "Blackout date ranges",
    "modes": {
      "ranges": {
        "params": ["ranges"]
      }
    }
  },

  "dateRange": {
    "label": "Date or date range",
    "modes": {
      "singleDate": {
        "params": ["date"]
      },
      "range": {
        "params": ["startDate", "endDate"]
      }
    }
  },

  "avoidTimes": {
    "label": "Avoid these times",
    "modes": {
      "windows": {
        "params": ["windows"]
      }
    }
  },

  "mustPrecede": {
    "label": "Must occur before",
    "modes": {
      "default": {
        "params": ["otherSegmentId"]
      }
    }
  },

  "mustFollow": {
    "label": "Must occur after",
    "modes": {
      "default": {
        "params": ["otherSegmentId"]
      }
    }
  }


}
