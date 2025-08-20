import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

const LocationsStep = ({ onComplete, onBack, initialData = [], isViewMode = false, onNextStep }) => {
  const [isEditing, setIsEditing] = useState(false);
  const createNewLocation = () => ({
    id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: '',
    address: '',
    emirate: 'dubai',
    totalFloorArea: '',
    numberOfFloors: 1,
    buildingType: '',
    ownershipType: '',
    meters: []
  });

  const [locations, setLocations] = useState(
    initialData.length > 0 ? initialData : [createNewLocation()]
  );

  const emirateOptions = [
    { value: 'dubai', label: 'Dubai' },
    { value: 'abu-dhabi', label: 'Abu Dhabi' },
    { value: 'sharjah', label: 'Sharjah' },
    { value: 'ajman', label: 'Ajman' },
    { value: 'ras-al-khaimah', label: 'Ras Al Khaimah' },
    { value: 'fujairah', label: 'Fujairah' },
    { value: 'umm-al-quwain', label: 'Umm Al Quwain' }
  ];

  const buildingTypeOptions = [
    { value: 'office', label: 'Office Building' },
    { value: 'retail', label: 'Retail Store' },
    { value: 'warehouse', label: 'Warehouse' },
    { value: 'manufacturing', label: 'Manufacturing Facility' },
    { value: 'hotel', label: 'Hotel' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'other', label: 'Other' }
  ];

  const ownershipTypeOptions = [
    { value: 'owned', label: 'Owned' },
    { value: 'leased', label: 'Leased' },
    { value: 'managed', label: 'Managed' }
  ];

  const meterTypeOptions = [
    { value: 'electricity', label: 'Electricity' },
    { value: 'water', label: 'Water' },
    { value: 'gas', label: 'Gas' },
    { value: 'other', label: 'Other' }
  ];

  const updateLocation = (index, field, value) => {
    const newLocations = [...locations];
    newLocations[index] = { ...newLocations[index], [field]: value };
    setLocations(newLocations);
  };

  const addLocation = () => {
    setLocations([...locations, createNewLocation()]);
  };

  const removeLocation = (index) => {
    if (locations.length > 1) {
      const newLocations = locations.filter((_, i) => i !== index);
      setLocations(newLocations);
    }
  };

  const addMeter = (locationIndex) => {
    const newMeter = {
      id: `meter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'electricity',
      description: 'Main Electricity Meter',
      meterNumber: '',
      provider: ''
    };
    
    const newLocations = [...locations];
    newLocations[locationIndex].meters.push(newMeter);
    setLocations(newLocations);
  };

  const removeMeter = (locationIndex, meterIndex) => {
    const newLocations = [...locations];
    newLocations[locationIndex].meters.splice(meterIndex, 1);
    setLocations(newLocations);
  };

  const updateMeter = (locationIndex, meterIndex, field, value) => {
    const newLocations = [...locations];
    const updates = { [field]: value };
    
    // Auto-update description when meter type changes
    if (field === 'type') {
      const typeDescriptions = {
        'electricity': 'Main Electricity Meter',
        'water': 'Main Water Meter',
        'gas': 'Main Gas Meter',
        'other': 'Main Meter'
      };
      updates.description = typeDescriptions[value] || 'Main Meter';
    }
    
    newLocations[locationIndex].meters[meterIndex] = {
      ...newLocations[locationIndex].meters[meterIndex],
      ...updates
    };
    setLocations(newLocations);
  };

  const validateLocations = () => {
    for (let i = 0; i < locations.length; i++) {
      const location = locations[i];
      if (!location.name || !location.address || !location.emirate) {
        toast.error(`Please complete all required fields for location ${i + 1}`);
        return false;
      }
    }
    return true;
  };

  const handleComplete = () => {
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (validateLocations()) {
      console.log('Locations completed:', locations);
      onComplete(locations);
    }
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  const handleSave = () => {
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (validateLocations()) {
      setIsEditing(false);
      onComplete(locations);
    }
  };

  const handleCancel = () => {
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setIsEditing(false);
    setLocations(initialData);
  };

  // Save to localStorage whenever locations change
  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const companyId = currentUser.company_id || 'temp';
    localStorage.setItem(`onboarding_locations_${companyId}`, JSON.stringify(locations));
  }, [locations]);

  return (
    <Card className="max-w-6xl mx-auto">
      <div className="space-y-8">
        {isViewMode && !isEditing && (
          <div className="flex justify-end">
            <Button onClick={handleEditToggle}>
              <i className="fas fa-edit mr-2"></i>
              Edit Locations
            </Button>
          </div>
        )}
        <div className="text-center space-y-2">
          <h2 className="text-text-high font-bold text-2xl flex items-center justify-center">
            <i className="fa-solid fa-map-marker-alt mr-3 text-brand-blue"></i>
            Locations & Facilities
          </h2>
          <p className="text-text-muted">
            Add all locations where your business operates to ensure comprehensive ESG coverage
          </p>
        </div>

        <div className="space-y-6">
          {locations.map((location, locationIndex) => (
            <div key={location.id} className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-text-high font-semibold text-lg">
                  Location {locationIndex + 1}
                </h3>
                {locations.length > 1 && (!isViewMode || isEditing) && (
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => removeLocation(locationIndex)}
                  >
                    <i className="fas fa-trash mr-1"></i>
                    Remove
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Input
                  label="Location Name *"
                  placeholder="e.g., Main Office, Warehouse 1"
                  value={location.name}
                  onChange={(e) => updateLocation(locationIndex, 'name', e.target.value)}
                  required={!isViewMode || isEditing}
                  disabled={isViewMode && !isEditing}
                />

                <Input
                  label="Address *"
                  placeholder="Full street address"
                  value={location.address}
                  onChange={(e) => updateLocation(locationIndex, 'address', e.target.value)}
                  required={!isViewMode || isEditing}
                  disabled={isViewMode && !isEditing}
                />

                <Select
                  label="Emirate *"
                  options={emirateOptions}
                  value={location.emirate}
                  onChange={(e) => updateLocation(locationIndex, 'emirate', e.target.value)}
                  required={!isViewMode || isEditing}
                  disabled={isViewMode && !isEditing}
                />

                <Select
                  label="Building Type"
                  options={buildingTypeOptions}
                  value={location.buildingType}
                  onChange={(e) => updateLocation(locationIndex, 'buildingType', e.target.value)}
                  disabled={isViewMode && !isEditing}
                />

                <Input
                  label="Total Floor Area (sq ft)"
                  type="number"
                  placeholder="Enter floor area"
                  value={location.totalFloorArea}
                  onChange={(e) => updateLocation(locationIndex, 'totalFloorArea', e.target.value)}
                  disabled={isViewMode && !isEditing}
                />

                <Input
                  label="Number of Floors"
                  type="number"
                  placeholder="Enter number of floors"
                  value={location.numberOfFloors}
                  onChange={(e) => updateLocation(locationIndex, 'numberOfFloors', e.target.value === '' ? '' : parseInt(e.target.value) || 1)}
                  disabled={isViewMode && !isEditing}
                />

                <Select
                  label="Ownership Type"
                  options={ownershipTypeOptions}
                  value={location.ownershipType}
                  onChange={(e) => updateLocation(locationIndex, 'ownershipType', e.target.value)}
                  disabled={isViewMode && !isEditing}
                />
              </div>

              {/* Meters Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-text-high font-medium">Utility Meters</h4>
                  {(!isViewMode || isEditing) && (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => addMeter(locationIndex)}
                      disabled={isViewMode && !isEditing}
                    >
                      <i className="fas fa-plus mr-1"></i>
                      Add Meter
                    </Button>
                  )}
                </div>

                {location.meters.map((meter, meterIndex) => (
                  <div key={meter.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex justify-between items-center mb-3">
                      <h5 className="text-text-high font-medium text-sm">
                        Meter {meterIndex + 1}
                      </h5>
                      {(!isViewMode || isEditing) && (
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => removeMeter(locationIndex, meterIndex)}
                          disabled={isViewMode && !isEditing}
                        >
                          <i className="fas fa-times"></i>
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Select
                        label="Meter Type"
                        options={meterTypeOptions}
                        value={meter.type}
                        onChange={(e) => updateMeter(locationIndex, meterIndex, 'type', e.target.value)}
                        disabled={isViewMode && !isEditing}
                      />

                      <Input
                        label="Description"
                        placeholder="e.g., Main electricity meter"
                        value={meter.description}
                        onChange={(e) => updateMeter(locationIndex, meterIndex, 'description', e.target.value)}
                        disabled={isViewMode && !isEditing}
                      />

                      <Input
                        label="Meter Number"
                        placeholder="Physical meter number"
                        value={meter.meterNumber}
                        onChange={(e) => updateMeter(locationIndex, meterIndex, 'meterNumber', e.target.value)}
                        disabled={isViewMode && !isEditing}
                      />

                      <Input
                        label="Utility Provider"
                        placeholder="e.g., DEWA, ADDC"
                        value={meter.provider}
                        onChange={(e) => updateMeter(locationIndex, meterIndex, 'provider', e.target.value)}
                        disabled={isViewMode && !isEditing}
                      />
                    </div>
                  </div>
                ))}

                {location.meters.length === 0 && (
                  <div className="text-center py-6 text-text-muted">
                    <div className="w-16 h-16 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-3">
                      <i className="fas fa-tachometer-alt text-2xl opacity-50"></i>
                    </div>
                    <p>No meters added yet. Add utility meters to track consumption data.</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {!isViewMode || isEditing ? (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={addLocation}
              className="mb-6"
              disabled={isViewMode && !isEditing}
            >
              <i className="fas fa-plus mr-2"></i>
              Add Another Location
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/10">
          <Button
            variant="outline"
            size="large"
            onClick={isViewMode && isEditing ? handleCancel : () => { window.scrollTo({ top: 0, behavior: 'smooth' }); onBack(); }}
          >
            <i className={`fas ${isViewMode && isEditing ? 'fa-times' : 'fa-arrow-left'} mr-2`}></i>
            {isViewMode ? (isEditing ? 'Cancel' : 'View Business Info') : 'Back'}
          </Button>
          
          {isViewMode && isEditing ? (
            <Button
              variant="primary"
              size="large"
              onClick={handleSave}
              className="flex-1"
            >
              Save Changes
              <i className="fas fa-save ml-2"></i>
            </Button>
          ) : (
            <Button
              variant="primary"
              size="large"
              onClick={isViewMode ? () => { window.scrollTo({ top: 0, behavior: 'smooth' }); onNextStep(); } : handleComplete}
              className="flex-1"
            >
              {isViewMode ? 'View ESG Assessment' : 'Continue to ESG Assessment'}
              <i className="fas fa-arrow-right ml-2"></i>
            </Button>
          )}
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-start space-x-3">
            <i className="fas fa-info-circle text-brand-blue mt-1"></i>
            <div className="space-y-1">
              <h4 className="text-text-high font-medium text-sm">Why do we need this information?</h4>
              <p className="text-text-muted text-xs">
                Location and meter data helps us generate accurate ESG assessments, 
                calculate your carbon footprint, and ensure compliance with UAE regulations.
                This information is essential for sustainability reporting and certification.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default LocationsStep;