import RatingModal from '../components/RatingModal'

const fakeTrip = {
  id: '00000000-0000-0000-0000-000000000001',
  origin_address: 'Charlotte Amalie',
  dest_address: 'Aeropuerto Cyril E. King'
}

export default function RatingTest() {
  return (
    <RatingModal
      trip={fakeTrip}
      raterId="00000000-0000-0000-0000-000000000001"
      ratedId="00000000-0000-0000-0000-000000000002"
      onClose={() => window.location.href = '/'}
    />
  )
}
