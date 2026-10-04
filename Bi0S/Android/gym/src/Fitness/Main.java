package Fitness;

public class Main {
    public static void main(String[] args) {

        Member m1 = new Member("Yadhu", 20, 49, 1.72);
        Trainer t1 = new Trainer("Arjun", 28, "Strength");

        m1.displayDetails();
        t1.displayDetails();

        try {
            double bmi = BMIService.calculateBMI(
                m1.getWeight(),
                m1.getHeight()
            );
            System.out.println("BMI: " + bmi);
        } catch (InvalidHealthDataException e) {
            System.out.println("Error: " + e.getMessage());
        }
    }
}