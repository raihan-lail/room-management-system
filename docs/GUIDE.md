# Camp Management System

A Property Management System (PMS) designed based on DSLNG Camp Management real cases. Adjustable for multiple sites in the future.

## Main Purpose

The main purpose of this system is to:

1. Manage resident data.
2. Manage rooms and beds data.
3. Monitor who booked and occupied a room and bed (based on booking data).
4. Manage bookings (create booking, manage arrival, monitor in-house, near-end-date reminders, check-in, check-out, and departure).
5. Manage complaints and booking ratings.
6. Manage home leave (create home leave, manage home leave, monitor room and resident statuses based on home leave).
7. Manage room allocations.
8. Provide data insights in the dashboard and Excel exports for bookings, residents, rooms, and home-leave data.

## Auth and RBAC System

1. The system has a superadmin that can access everything across the system.
2. The system has a flexible RBAC system, meaning everything is adjustable, including roles and permissions.
3. The superadmin or any desired role can create roles, create permissions, and attach permissions to roles.
4. There is no self-register feature. Only the superadmin or any desired role can register employees or residents, and attach sites and permissions to employees.
5. Residents have their own entity (different from employees). They are not attached to permissions and have dedicated pages to display their bookings, submit complaints, and give ratings.

## Main System Flow

### Booking and Arrival

1. The resident sends a booking request via email to the receptionist, providing the necessary information, including identity, requested arrival date, departure date, and accommodation requirements.

2. The receptionist receives the email and accesses the system. If the resident does not already exist in the system, the receptionist creates a resident record and enters the required personal information.

3. The receptionist searches for available beds in rooms based on the requested dates, site, location, room requirements, existing bookings, and room allocations. The system checks for overlapping reservations and room allocations to prevent double booking. The receptionist can also drag-book on the calendar view based on rooms, beds, and stay date.

4. After selecting an available bed, the receptionist creates a booking record containing the resident, assigned bed, `started_at`, `ended_at`, notes, and other required information. The booking status is set to `CONFIRMED` and the room status is set to `BOOKED`.

5. On the resident's scheduled arrival date (`started_at`), the receptionist accesses **Front Desk → Arrival**. The system displays confirmed bookings expected to arrive that day.

6. The receptionist selects the resident's booking, verifies the resident's identity and booking details, and confirms that the assigned bed and room are ready for occupancy.

7. After successful verification, the receptionist checks the resident in and hands over the room key. The system creates an occupancy record containing the booking, actual room, check-in timestamp, and the employee responsible for check-in.

8. If the resident does not arrive on the `started_at` date, the receptionist asks for confirmation from the resident. The receptionist can cancel the booking after confirmation from the resident or wait until the resident arrives.

9. The booking status changes to `IN HOUSE` and the bed status changes to `OCCUPIED`.

### In-House Stay

10. The resident's current stay is displayed in **Front Desk → In House**. The system uses the occupancy record to identify residents who have checked in but have not checked out.

11. If a resident does not arrive on the scheduled date, the receptionist contacts the resident to confirm their plans. The booking remains `CONFIRMED` while the situation is being resolved.

12. If the resident cancels the booking, the receptionist records the cancellation. The system changes the booking status to `CANCELLED` and records the cancellation timestamp, responsible employee, and cancellation reason.

13. If the resident does not respond or fails to arrive, the receptionist follows the organization's no-show policy. The system should not automatically treat the booking as cancelled unless the configured policy permits it.

14. Once a booking is cancelled, the bed or room is released for future reservations, provided there are no other active bookings or room allocations preventing its availability.

15. During the stay, the resident occupies the assigned room until the scheduled departure date (`ended_at`), unless the booking is extended, cancelled under an applicable policy, or otherwise modified.

16. The receptionist can view active residents and their assigned rooms through **Front Desk → In House**. The system displays relevant information, including booking ID, resident name, bed, room, check-in time, and expected departure date.

17. The bed status remains `OCCUPIED` while the resident is physically staying in the bed and room. The booking status remains `IN HOUSE` throughout the active stay.

### Home Leave

18. If a resident plans to leave the premises temporarily, the resident contacts the receptionist and provides the expected departure time, return time, and reason for the home leave.

19. The receptionist records the home-leave information in the system. A new record is created in `home_leaves`, linked to the resident's active occupancy. The record contains the start time, expected return time, reason, and approval information where applicable.

20. When the resident actually leaves the room, the receptionist confirms the departure. The room status changes from `OCCUPIED` to `HOME_LEAVE`, while the booking status changes to `HOME_LEAVE`.

21. The current home-leave records are displayed in **Front Desk → Home Leave**. The system displays the resident's name, room, booking ID, departure time, expected return time, and home-leave duration.

22. The dedicated Home Leave page provides additional functions, including searching home-leave records, viewing upcoming leave, filtering by site and date, and reviewing historical home-leave periods.

23. When the resident returns, the receptionist confirms the return and closes the active home-leave record by recording the actual return time. The bed status changes from `HOME_LEAVE` back to `OCCUPIED`. The booking status remains `IN HOUSE`.

24. If the resident has multiple home-leave periods during one stay, the system creates a separate `home_leaves` record for each period. This allows the system to maintain complete home-leave history and calculate durations accurately.

### Stay Extension

25. If the resident wants to extend their stay, the resident contacts the receptionist before the current departure date and provides the requested new departure date.

26. The receptionist checks the requested extension against future bookings, room allocations, and room availability. If the current room is unavailable for the extended period, the receptionist determines whether another room can be assigned.

27. Once the extension is approved, the receptionist updates the booking's `ended_at` value. The system records the previous departure date, new departure date, approval information, and reason in a booking-extension history record if extension history is required.

28. If the resident is already staying in the room, the booking status remains `IN HOUSE` and the room status remains `OCCUPIED`, or `HOME_LEAVE` if the resident is currently away on home leave. The system updates the expected departure information shown in Front Desk and the calendar.

### Departure and Check-Out

29. On the scheduled departure date, bookings expected to end that day are displayed in **Front Desk → Departure**. The system filters for bookings whose `ended_at` falls on the current date and whose stay is still active.

30. The receptionist confirms the resident's departure, receives the room key, verifies the bed and room's condition, and completes the check-out process.

31. The system records the actual check-out timestamp and the employee responsible in the occupancy record. The booking status changes to `CHECKED OUT` and the bed status changes to `VACANT` once the room has been released for use.

32. If the room requires maintenance, cleaning, or another internal allocation before it can be used again, the receptionist or authorized employee records the actions. The room must not be offered for another booking until it is available for use.

### Ratings, Complaints, and Archiving

33. After the resident completes the stay, the resident may access the system through the designated resident interface to submit a rating for the completed booking. The system stores the rating, score, details, submission timestamp, and associated booking ID.

34. During or after the stay, the resident may submit a complaint through the system. Each complaint is associated with the relevant booking and includes its type, details, and submission timestamp.

35. The receptionist or another authorized employee reviews and handles submitted complaints. The system should record complaint status, assignment, and resolution information if complaint tracking is required.

36. The system prevents unauthorized users from viewing or modifying ratings, complaints, and resident information. Access is controlled by the permissions assigned to each role.

37. After check-out and completion of the required operational processes, the booking remains available as a historical record. When the applicable retention or archiving conditions are met, an authorized employee or scheduled process changes the booking status to `ARCHIVED`.

38. Archiving does not delete the booking's associated occupancy, home-leave history, ratings, complaints, or extension history. These records remain available for authorized historical searches and reporting.

### Reporting

39. The system processes booking, occupancy, room, home-leave, room-allocation, rating, and complaint records to produce operational reports and dashboard insights.

40. Users with the `REPORTING` role can access authorized reports, apply filters, and export data where their permissions allow it.

41. The system provides reports and dashboard summaries.
