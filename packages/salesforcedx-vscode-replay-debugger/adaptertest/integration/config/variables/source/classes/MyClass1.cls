global class MyClass1 {
    public class MyInnerClass1 {
        private Integer myInteger;
        private String myString;
        
        public MyInnerClass1(Integer myInteger, String myString) {
            this.myInteger = myInteger;
            this.myString = myString;
        }
    }
    
    public static MyInnerClass1 myClass = new MyInnerClass1(1, 'One');
    public static List<Integer> mySimpleList = new List<Integer> {1, 2};
    public static List<MyInnerClass1> myComplexList = new List<MyInnerClass1> {new MyInnerClass1(1, 'One'), new MyInnerClass1(2, 'Two')};
    public static List<List<String>> myNestedList = new List<List<String>>();
    public static Map<Integer, String> mySimpleMap = new Map<Integer, String> {1 => 'One', 2 => 'Two'};
    public static Map<Integer, MyInnerClass1> myComplexMap = new Map<Integer, MyInnerClass1> {1 => new MyInnerClass1(1, 'One'), 2 => new MyInnerClass1(2, 'Two')};
    public static Set<Integer> mySimpleSet = new Set<Integer>(new List<Integer> {1, 2, 1});
    public static Set<MyInnerClass1> myComplexSet = new Set<MyInnerClass1>(new List<MyInnerClass1> {new MyInnerClass1(1, 'One'), new MyInnerClass1(2, 'Two')});
    
    public enum Season {WINTER, SPRING, SUMMER, FALL}
    
    public static void foo() {
        Blob blobVar = Blob.valueOf('Blob');
        Boolean booleanVar = true;
        Date dateVar = Date.newInstance(1990, 1, 3);
        Datetime datetimeVar = Datetime.newInstance(1980, 10, 1);
        Decimal decimalVar = 0.002;
        Double doubleVar = 3.14159;
        Season enumVar = Season.SUMMER;
        ID idVar = UserInfo.getUserId();
        Integer integerVar = 42;
        Long longVar = 123456789L;
        String stringVar = 'Lorem ipsum dolor sit amet, consectetur adipis; elit. Aliquam dictum cursus nulla';
        Time timeVar = Time.newInstance(1, 2, 3, 4);
        
        new MyClass2().foo(myClass);
        
        System.debug('End placeholder for setting breakpoint');
    }
}